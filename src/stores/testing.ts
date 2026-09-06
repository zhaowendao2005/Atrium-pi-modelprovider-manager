import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { resolveAdapterPolicy } from "../adapters/factory.js";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ExecutionState,
  TaskCategory,
  TestTask,
  TestMetrics,
  UIMessage,
  MessagePart,
  ToolInvocationState,
  RequestMetricItem,
  BatchModelTarget,
  BatchTestCardItem,
  WorkbenchLayoutMode,
  TestSession,
  TestGroup,
  SessionFilterOptions,
} from "../types/testing.js";
import { DEFAULT_TEST_TASKS } from "./testing-presets.js";
import { useProviderStore } from "./provider.js";

// 估算 Token 数量 (中文字符约 1 token，英文单词约 1.3 token)
function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = text
    .replace(/[\u4e00-\u9fa5]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, chineseChars + Math.round(englishWords * 1.3));
}

let globalRpcListenerPromise: Promise<UnlistenFn> | null = null;

export const useTestingStore = defineStore("testing", {
  state: () => ({
    // 测试任务库（使用 DEFAULT_TEST_TASKS 深拷贝打底，保证首帧长度为 5）
    tasks: JSON.parse(JSON.stringify(DEFAULT_TEST_TASKS)) as TestTask[],
    activeTaskId: DEFAULT_TEST_TASKS[0]?.id || ("" as string),
    tasksLoaded: false as boolean,

    // 布局与多卡片槽位核心状态
    layoutMode: "single" as WorkbenchLayoutMode,
    activeGroupId: null as string | null,
    activeSlotSessionIds: [] as string[],
    focusedSlotIndex: 0 as number,
    concurrencyLimit: 4 as number,

    // 持久化测试历史 (SQLite)
    groups: [] as TestGroup[],
    sessions: {} as Record<string, TestSession>,
    historyLoaded: false as boolean,
    historyFilter: {
      taskId: "all",
      status: "all",
      dateRange: "all",
      searchQuery: "",
    } as SessionFilterOptions,

    // 当前选中的 Provider 与 Model（支持联动）
    selectedProviderId: "" as string,
    selectedModelId: "" as string,

    // 过滤与分类
    searchQuery: "" as string,
    selectedCategory: "all" as TaskCategory,

    // 状态机核心
    executionState: "idle" as ExecutionState,
    currentWorkspaceDir: "" as string,

    // 消息流式列表
    messages: [] as UIMessage[],

    // 性能指标面板（扩展双轨 TPS 与时序请求记录）
    metrics: {
      totalDurationMs: 0,
      firstTokenMs: 0,
      totalTokens: 0,
      completionTokens: 0,
      tps: 0,
      tpsWithTtft: 0,
      tpsWithoutTtft: 0,
      toolCallsCount: 0,
      requestMetrics: [] as RequestMetricItem[],
    } as TestMetrics,

    // 当前轮次微观指标采集器
    currentRequestMetric: null as RequestMetricItem | null,
    requestCounter: 0,

    // 批量评测矩阵状态
    isBatchMode: false as boolean,
    batchTargets: [] as BatchModelTarget[],
    batchCards: [] as BatchTestCardItem[],
    batchQueueIndex: -1 as number,
    isBatchRunning: false as boolean,

    // 任务运行历史缓存 (taskId -> UIMessage[])
    taskHistory: {} as Record<string, UIMessage[]>,

    // Tauri 事件解绑句柄
    unlistenRpc: null as UnlistenFn | null,

    // 工具参数缓冲区：toolCallId -> { id, name, rawArgs }
    toolCallBuffers: new Map<string, { id: string; name: string; rawArgs: string }>(),

    // 计时器
    runStartTime: 0 as number,
    metricsTimer: null as any,
    firstTokenRecorded: false as boolean,
  }),

  getters: {
    activeTask(state): TestTask {
      const found = state.tasks.find((t) => t.id === state.activeTaskId);
      return found || state.tasks[0] || DEFAULT_TEST_TASKS[0];
    },

    filteredTasks(state): TestTask[] {
      return state.tasks.filter((task) => {
        const matchesCategory =
          state.selectedCategory === "all" || task.category === state.selectedCategory;
        const query = state.searchQuery.trim().toLowerCase();
        const matchesQuery =
          !query ||
          task.name.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          task.userPrompt.toLowerCase().includes(query);
        return matchesCategory && matchesQuery;
      });
    },

    isRunning(state): boolean {
      return [
        "preparing_workspace",
        "running_agent",
        "streaming_reasoning",
        "calling_tool",
        "streaming_text",
      ].includes(state.executionState);
    },

    currentModelDisplay(): { providerName: string; modelName: string; providerId: string; modelId: string } {
      const providerStore = useProviderStore();
      const pId = this.selectedProviderId || this.activeTask.providerId || providerStore.activeProvider?.id || "";
      const provider = providerStore.providers.find((p) => p.id === pId);
      const mId = this.selectedModelId || this.activeTask.modelId || provider?.models?.[0]?.id || "默认模型";
      return {
        providerId: pId,
        modelId: mId,
        providerName: provider?.name || provider?.id || "未指定提供商",
        modelName: mId,
      };
    },

    workspaceShortName(state): string {
      if (!state.currentWorkspaceDir) return "";
      const parts = state.currentWorkspaceDir.split(/[\\/]/);
      return parts[parts.length - 1] || state.currentWorkspaceDir;
    },

    activeSlotSession(state): TestSession | null {
      const sid = state.activeSlotSessionIds[state.focusedSlotIndex] || state.activeSlotSessionIds[0];
      if (sid && state.sessions[sid]) {
        return state.sessions[sid];
      }
      const keys = Object.keys(state.sessions);
      if (keys.length > 0) {
        return state.sessions[keys[0]];
      }
      return null;
    },

    activeGroup(state): TestGroup | null {
      if (!state.activeGroupId) return null;
      return state.groups.find((g) => g.id === state.activeGroupId) || null;
    },

    slotSessions(state): (TestSession | null)[] {
      return state.activeSlotSessionIds.map((id) => state.sessions[id] || null);
    },

    filteredHistorySessions(state): TestSession[] {
      const all = Object.values(state.sessions).sort((a, b) => b.createdAt - a.createdAt);
      return all.filter((s) => {
        if (state.historyFilter.taskId && state.historyFilter.taskId !== "all" && s.taskId !== state.historyFilter.taskId) {
          return false;
        }
        if (state.historyFilter.status && state.historyFilter.status !== "all" && s.status !== state.historyFilter.status) {
          return false;
        }
        if (state.historyFilter.searchQuery) {
          const q = state.historyFilter.searchQuery.toLowerCase();
          const matchModel = (s.modelName || s.modelId).toLowerCase().includes(q);
          const matchProvider = (s.providerName || s.providerId).toLowerCase().includes(q);
          if (!matchModel && !matchProvider) return false;
        }
        if (state.historyFilter.dateRange && state.historyFilter.dateRange !== "all") {
          const now = Date.now();
          const diffMs = now - s.createdAt;
          if (state.historyFilter.dateRange === "today" && diffMs > 86400000) return false;
          if (state.historyFilter.dateRange === "week" && diffMs > 7 * 86400000) return false;
          if (state.historyFilter.dateRange === "month" && diffMs > 30 * 86400000) return false;
        }
        return true;
      });
    },

    filteredHistoryGroups(state): TestGroup[] {
      const all = [...state.groups].sort((a, b) => b.createdAt - a.createdAt);
      return all.filter((g) => {
        if (state.historyFilter.taskId && state.historyFilter.taskId !== "all" && g.taskId !== state.historyFilter.taskId) {
          return false;
        }
        if (state.historyFilter.searchQuery) {
          const q = state.historyFilter.searchQuery.toLowerCase();
          if (!g.name.toLowerCase().includes(q)) return false;
        }
        if (state.historyFilter.dateRange && state.historyFilter.dateRange !== "all") {
          const now = Date.now();
          const diffMs = now - g.createdAt;
          if (state.historyFilter.dateRange === "today" && diffMs > 86400000) return false;
          if (state.historyFilter.dateRange === "week" && diffMs > 7 * 86400000) return false;
          if (state.historyFilter.dateRange === "month" && diffMs > 30 * 86400000) return false;
        }
        return true;
      });
    },

    runningSessionsCount(state): number {
      return Object.values(state.sessions).filter(
        (s) => s.status === "running" || s.status === "preparing"
      ).length;
    },
  },

  actions: {
    /**
     * 从后端加载测试任务模板与历史记录
     */
    async loadTasks() {
      await this.reloadTasks();
      await this.loadHistoryFromDb();
    },

    async loadHistoryFromDb() {
      if (this.historyLoaded) return;
      try {
        const res: { groups: TestGroup[]; sessions: TestSession[] } = await invoke("db_load_test_history");
        this.groups = res.groups || [];
        const sessionMap: Record<string, TestSession> = {};
        for (const s of res.sessions || []) {
          if (s.messages) {
            s.messages = s.messages.filter((m) => {
              if (m.role === "user") return true;
              if (m.role === "assistant") {
                const hasContent = Boolean(m.content && m.content.trim().length > 0);
                const hasParts = Boolean(m.parts && m.parts.length > 0);
                const hasReasoning = Boolean(m.reasoning?.content);
                const hasTools = Boolean(m.toolInvocations && m.toolInvocations.length > 0);
                return hasContent || hasParts || hasReasoning || hasTools;
              }
              return true;
            });
          }
          sessionMap[s.id] = s;
        }
        this.sessions = sessionMap;

        // 如果没有活跃槽位，选定首个群组或最新会话
        if (this.activeSlotSessionIds.length === 0) {
          if (this.groups.length > 0) {
            const latestGroup = this.groups[0];
            this.activeGroupId = latestGroup.id;
            this.layoutMode = latestGroup.layoutMode || "single";
            const groupSessions = Object.values(sessionMap)
              .filter((s) => s.groupId === latestGroup.id)
              .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
            this.activeSlotSessionIds = groupSessions.map((s) => s.id);
          } else if (Object.keys(sessionMap).length > 0) {
            const sorted = Object.values(sessionMap).sort((a, b) => b.createdAt - a.createdAt);
            this.activeSlotSessionIds = [sorted[0].id];
            this.layoutMode = "single";
          } else {
            // 初始化一个空白单卡片 session
            const initial = this.createSession({
              taskId: this.activeTaskId,
              providerId: this.selectedProviderId,
              modelId: this.selectedModelId,
            });
            this.activeSlotSessionIds = [initial.id];
            this.layoutMode = "single";
          }
        }
        this.historyLoaded = true;
      } catch (e) {
        console.error("加载测试历史失败:", e);
      }
    },

    async saveGroupToDb(group: TestGroup) {
      try {
        await invoke("db_save_test_group", { group });
      } catch (e) {
        console.error("保存测试组失败:", e);
      }
    },

    async deleteGroup(groupId: string) {
      try {
        await invoke("db_delete_test_group", { groupId });
        this.groups = this.groups.filter((g) => g.id !== groupId);
        for (const sid of Object.keys(this.sessions)) {
          if (this.sessions[sid]?.groupId === groupId) {
            delete this.sessions[sid];
          }
        }
        if (this.activeGroupId === groupId) {
          this.activeGroupId = null;
          const remainingSessions = Object.values(this.sessions);
          if (remainingSessions.length > 0) {
            this.activeSlotSessionIds = [remainingSessions[0].id];
            this.layoutMode = "single";
          } else {
            this.activeSlotSessionIds = [""];
            this.layoutMode = "single";
          }
        }
      } catch (e) {
        console.error("删除测试组失败:", e);
      }
    },

    async saveSessionToDb(session: TestSession) {
      try {
        if (session.messages && session.messages.length > 0) {
          session.messages = session.messages.filter((m) => {
            if (m.role === "user") return true;
            if (m.role === "assistant") {
              const hasContent = Boolean(m.content && m.content.trim().length > 0);
              const hasParts = Boolean(m.parts && m.parts.length > 0);
              const hasReasoning = Boolean(m.reasoning?.content);
              const hasTools = Boolean(m.toolInvocations && m.toolInvocations.length > 0);
              return hasContent || hasParts || hasReasoning || hasTools || m.isStreaming;
            }
            return true;
          });
        }
        await invoke("db_save_test_session", { session });
      } catch (e) {
        console.error("保存测试会话失败:", e);
      }
    },

    async deleteSession(sessionId: string) {
      try {
        await invoke("db_delete_test_session", { sessionId });
        delete this.sessions[sessionId];
        this.activeSlotSessionIds = this.activeSlotSessionIds.filter((id) => id !== sessionId);
        if (this.activeSlotSessionIds.length === 0) {
          const remaining = Object.values(this.sessions);
          if (remaining.length > 0) {
            this.activeSlotSessionIds = [remaining[0].id];
          } else {
            this.activeSlotSessionIds = [""];
          }
        }
      } catch (e) {
        console.error("删除测试会话失败:", e);
      }
    },

    setLayoutMode(mode: WorkbenchLayoutMode) {
      this.layoutMode = mode;
      const neededCount =
        mode === "single"
          ? 1
          : mode === "dual"
          ? 2
          : mode === "quad"
          ? 4
          : Math.max(2, this.activeSlotSessionIds.length);
      while (this.activeSlotSessionIds.length < neededCount) {
        const allSessionIds = Object.keys(this.sessions);
        const unused = allSessionIds.find((id) => !this.activeSlotSessionIds.includes(id));
        if (unused) {
          this.activeSlotSessionIds.push(unused);
        } else {
          // 插入未绑定空白槽位，不自动向数据库生造无意义会话
          this.activeSlotSessionIds.push("");
        }
      }
      if (this.focusedSlotIndex >= this.activeSlotSessionIds.length) {
        this.focusedSlotIndex = 0;
      }
    },

    addBlankSlot() {
      this.activeSlotSessionIds.push("");
      this.focusedSlotIndex = this.activeSlotSessionIds.length - 1;
    },

    removeSlot(slotIndex: number) {
      const isDynamicLayout = this.layoutMode === "multi-col" || this.layoutMode === "two-row-multi-col";
      if (isDynamicLayout) {
        if (this.activeSlotSessionIds.length > 1) {
          this.activeSlotSessionIds.splice(slotIndex, 1);
          if (this.focusedSlotIndex >= this.activeSlotSessionIds.length) {
            this.focusedSlotIndex = Math.max(0, this.activeSlotSessionIds.length - 1);
          }
        } else {
          this.activeSlotSessionIds = [""];
          this.focusedSlotIndex = 0;
        }
      } else {
        // 固定网格布局 (single, dual, quad)：解绑当前槽位，变为空白卡片
        if (slotIndex >= 0 && slotIndex < this.activeSlotSessionIds.length) {
          this.activeSlotSessionIds[slotIndex] = "";
        }
      }
    },

    selectGroup(groupId: string) {
      const group = this.groups.find((g) => g.id === groupId);
      if (!group) return;
      this.activeGroupId = groupId;
      this.layoutMode = group.layoutMode || "single";
      const groupSessions = Object.values(this.sessions)
        .filter((s) => s.groupId === groupId)
        .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
      if (groupSessions.length > 0) {
        this.activeSlotSessionIds = groupSessions.map((s) => s.id);
      }
      this.focusedSlotIndex = 0;
    },

    selectSession(sessionId: string) {
      if (this.layoutMode === "single") {
        this.activeSlotSessionIds = [sessionId];
        this.focusedSlotIndex = 0;
      } else {
        const index = Math.min(this.focusedSlotIndex, Math.max(0, this.activeSlotSessionIds.length - 1));
        if (index >= 0 && this.activeSlotSessionIds.length > 0) {
          this.activeSlotSessionIds[index] = sessionId;
        } else {
          this.activeSlotSessionIds.push(sessionId);
        }
      }
    },

    setFocusedSlot(index: number) {
      if (index >= 0 && index < this.activeSlotSessionIds.length) {
        this.focusedSlotIndex = index;
      }
    },

    slotSession(index: number, sessionId: string) {
      if (index >= 0 && index < this.activeSlotSessionIds.length) {
        this.activeSlotSessionIds[index] = sessionId;
      }
    },

    createSession(params: {
      taskId?: string;
      providerId?: string;
      modelId?: string;
      groupId?: string;
      slotIndex?: number;
    } = {}): TestSession {
      const providerStore = useProviderStore();
      const pId = params.providerId || this.selectedProviderId || providerStore.activeProvider?.id || "";
      const provider = providerStore.providers.find((p) => p.id === pId);
      const mId = params.modelId || this.selectedModelId || provider?.models?.[0]?.id || "default";
      const tId = params.taskId || this.activeTaskId || (this.tasks[0]?.id ?? "01_speed_and_stream");

      const sid = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const task = this.tasks.find((t) => t.id === tId) || this.tasks[0];

      const newSession: TestSession = {
        id: sid,
        groupId: params.groupId,
        taskId: tId,
        providerId: pId,
        modelId: mId,
        providerName: provider?.name || pId,
        modelName: mId,
        status: "idle",
        messages: task?.userPrompt
          ? [
              {
                id: `msg-preview-${Date.now()}`,
                role: "user",
                content: task.userPrompt,
                createdAt: Date.now(),
              },
            ]
          : [],
        metrics: {
          totalDurationMs: 0,
          firstTokenMs: 0,
          totalTokens: 0,
          completionTokens: 0,
          tps: 0,
          tpsWithTtft: 0,
          tpsWithoutTtft: 0,
          toolCallsCount: 0,
          requestMetrics: [],
        },
        slotIndex: params.slotIndex ?? 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.sessions[sid] = newSession;
      this.saveSessionToDb(newSession);
      return newSession;
    },

    async initGlobalRpcListener() {
      // 1. 若当前会话已有生效中的句柄且全局处于激活态，直接返回
      if ((window as any).__PI_RPC_LISTENER_ACTIVE__) {
        return;
      }
      // 2. 若有正在异步挂起中的注册 Promise，直接复用等待，避免并发穿透
      if (globalRpcListenerPromise) {
        await globalRpcListenerPromise;
        return;
      }

      // 3. 启动唯一全局监听注册
      globalRpcListenerPromise = (async () => {
        // 若 Vite HMR 热重载遗留了旧监听闭包，先执行解绑彻底清理
        if (typeof (window as any).__PI_RPC_UNLISTEN__ === "function") {
          try {
            (window as any).__PI_RPC_UNLISTEN__();
          } catch {
            // ignore
          }
          (window as any).__PI_RPC_UNLISTEN__ = null;
        }

        const unlisten = await listen<string>("pi-rpc-event", (evt) => {
          const raw = evt.payload;
          if (!raw) return;
          let sessionId: string | null = null;
          let eventPayload = raw;
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && "sessionId" in parsed && "raw" in parsed) {
              sessionId = parsed.sessionId;
              eventPayload = parsed.raw;
            }
          } catch {
            // raw line fallback
          }

          // 动态解析最新 Pinia store，保证在任何组件上下文中状态一致
          const currentStore = useTestingStore();
          const session = sessionId ? currentStore.sessions[sessionId] : currentStore.activeSlotSession;
          if (session) {
            currentStore.handleRpcEventForSession(session, eventPayload);
          } else {
            currentStore.handleRpcEvent(eventPayload);
          }
        });

        (window as any).__PI_RPC_UNLISTEN__ = unlisten;
        (window as any).__PI_RPC_LISTENER_ACTIVE__ = true;
        this.unlistenRpc = unlisten;
        return unlisten;
      })();

      try {
        await globalRpcListenerPromise;
      } catch (err) {
        globalRpcListenerPromise = null;
        (window as any).__PI_RPC_LISTENER_ACTIVE__ = false;
        this.unlistenRpc = null;
        throw err;
      }
    },

    startNewRequestMetricForSession(session: TestSession) {
      const idx = (session.metrics.requestMetrics?.length || 0) + 1;
      session.currentRequestMetric = {
        id: `req-${session.id}-${idx}-${Date.now()}`,
        index: idx,
        role: "assistant",
        startTime: Date.now(),
        ttftMs: 0,
        durationMs: 0,
        completionTokens: 0,
        tpsWithTtft: 0,
        tpsWithoutTtft: 0,
        hasTools: false,
        toolNames: [],
        status: "streaming",
      };
    },

    updateSessionTps(session: TestSession) {
      if (!session.currentRequestMetric) return;
      const now = Date.now();
      const durMs = Math.max(1, now - session.currentRequestMetric.startTime);
      session.currentRequestMetric.durationMs = durMs;

      const tokens = session.currentRequestMetric.completionTokens;
      const ttft = session.currentRequestMetric.ttftMs || 0;

      session.currentRequestMetric.tpsWithTtft = Math.round((tokens / (durMs / 1000)) * 10) / 10;
      if (durMs > ttft && tokens > 1) {
        const genDur = (durMs - ttft) / 1000;
        session.currentRequestMetric.tpsWithoutTtft = Math.round(((tokens - 1) / genDur) * 10) / 10;
      } else {
        session.currentRequestMetric.tpsWithoutTtft = session.currentRequestMetric.tpsWithTtft;
      }

      session.metrics.completionTokens = tokens;
      session.metrics.totalTokens = tokens;
      session.metrics.totalDurationMs = durMs;
      session.metrics.tpsWithTtft = session.currentRequestMetric.tpsWithTtft;
      session.metrics.tpsWithoutTtft = session.currentRequestMetric.tpsWithoutTtft;
      session.metrics.tps = session.currentRequestMetric.tpsWithTtft;
    },

    finishCurrentRequestMetricForSession(session: TestSession) {
      if (!session.currentRequestMetric) return;
      session.currentRequestMetric.status = "completed";
      session.currentRequestMetric.endTime = Date.now();
      this.updateSessionTps(session);
      if (!session.metrics.requestMetrics) session.metrics.requestMetrics = [];
      session.metrics.requestMetrics.push({ ...session.currentRequestMetric });
      session.currentRequestMetric = null;
    },

    findToolPartInSession(session: TestSession, toolCallId: string): { msg: UIMessage; part: MessagePart } | null {
      if (!toolCallId || !session.messages) return null;
      for (let i = session.messages.length - 1; i >= 0; i--) {
        const msg = session.messages[i];
        if (msg.role !== "assistant" || !msg.parts) continue;
        for (const part of msg.parts) {
          if (part.type === "tool") {
            const a = part.toolCallId;
            const b = toolCallId;
            const match = a === b || a.split("|").some((p) => b.split("|").includes(p)) || a.startsWith(b) || b.startsWith(a);
            if (match) {
              return { msg, part };
            }
          }
        }
      }
      return null;
    },

    handleRpcEventForSession(session: TestSession, rawLine: string) {
      if (!rawLine || !rawLine.trim()) return;
      let event: any;
      try {
        event = JSON.parse(rawLine);
      } catch {
        return;
      }

      // 1. 错误事件与提供商失败处理
      if (event.type === "response" && !event.success) {
        session.status = "failed";
        session.error = event.error || "未知执行错误";
        const errMsg = `[提供商/模型执行异常]: ${session.error}`;
        const latestAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
        if (latestAssistant) {
          latestAssistant.content = errMsg;
          latestAssistant.isStreaming = false;
          latestAssistant.parts = latestAssistant.parts || [];
          latestAssistant.parts.push({
            id: `err-${Date.now()}`,
            type: "text",
            content: errMsg,
            isStreaming: false,
            createdAt: Date.now(),
          });
        }
        this.finishCurrentRequestMetricForSession(session);
        this.saveSessionToDb(session);
        return;
      }

      const msgObj = event.message || (Array.isArray(event.messages) ? event.messages.find((m: any) => m.errorMessage || m.stopReason === "error") : null);
      if (msgObj && (msgObj.stopReason === "error" || msgObj.errorMessage)) {
        session.status = "failed";
        session.error = msgObj.errorMessage || "模型调用发生异常";
        const errMsg = `[提供商/模型异常]: ${session.error}`;
        const latestAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
        if (latestAssistant) {
          latestAssistant.content = errMsg;
          latestAssistant.isStreaming = false;
          latestAssistant.parts = latestAssistant.parts || [];
          latestAssistant.parts.push({
            id: `err-${Date.now()}`,
            type: "text",
            content: errMsg,
            isStreaming: false,
            createdAt: Date.now(),
          });
        }
        this.finishCurrentRequestMetricForSession(session);
        this.saveSessionToDb(session);
      }

      // 2. 独立处理工具执行生命周期事件（彻底解耦于 assistantMsg.isStreaming 状态）
      if (event.type === "tool_execution_start") {
        const toolId = event.toolCallId || event.id;
        const toolName = event.toolName || event.tool || "tool";
        const args = event.args || {};
        const found = this.findToolPartInSession(session, toolId);
        if (found && found.part.type === "tool") {
          found.part.state = "call";
          if (Object.keys(args).length > 0) found.part.args = args;
        } else {
          // 若之前 toolcall_end 未及时推送，则挂载到最近的 Assistant 消息中
          const latestAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
          if (latestAssistant) {
            latestAssistant.parts = latestAssistant.parts || [];
            latestAssistant.parts.push({
              id: toolId || `tool-${Date.now()}`,
              type: "tool",
              toolCallId: toolId || `tool-${Date.now()}`,
              toolName,
              args,
              state: "call",
              isCollapsed: true,
              createdAt: Date.now(),
            });
            session.metrics.toolCallsCount++;
          }
        }
        return;
      }

      if (event.type === "tool_execution_update") {
        const toolId = event.toolCallId || event.id;
        const found = this.findToolPartInSession(session, toolId);
        if (found && found.part.type === "tool" && event.partialResult) {
          found.part.result = event.partialResult;
        }
        return;
      }

      if (event.type === "tool_execution_end") {
        const toolId = event.toolCallId || event.id;
        const result = event.result ?? event.output;
        const isError = Boolean(event.isError);
        const error = isError ? (event.error || (result?.content?.[0]?.text ?? "工具执行发生异常")) : undefined;
        const duration = event.executionTimeMs || 0;
        const found = this.findToolPartInSession(session, toolId);
        if (found && found.part.type === "tool") {
          found.part.state = "result";
          found.part.result = result;
          found.part.error = error;
          found.part.executionTimeMs = duration;
        } else {
          const latestAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
          if (latestAssistant) {
            latestAssistant.parts = latestAssistant.parts || [];
            latestAssistant.parts.push({
              id: toolId || `tool-${Date.now()}`,
              type: "tool",
              toolCallId: toolId || `tool-${Date.now()}`,
              toolName: event.toolName || "tool",
              args: {},
              state: "result",
              result,
              error,
              executionTimeMs: duration,
              isCollapsed: true,
              createdAt: Date.now(),
            });
            session.metrics.toolCallsCount++;
          }
        }
        return;
      }

      if (event.type === "turn_end") {
        // 一轮交互结束，核对并关闭可能遗漏的工具状态
        if (Array.isArray(event.toolResults)) {
          for (const tr of event.toolResults) {
            const found = this.findToolPartInSession(session, tr.toolCallId);
            if (found && found.part.type === "tool" && found.part.state === "call") {
              found.part.state = "result";
              found.part.result = tr.content;
              found.part.error = tr.isError ? "工具执行失败" : undefined;
            }
          }
        }
        return;
      }

      if (event.type === "agent_settled") {
        // 会话全部任务完成
        const latestAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
        if (latestAssistant) {
          latestAssistant.isStreaming = false;
          for (const p of latestAssistant.parts || []) {
            if (p.type === "text") p.isStreaming = false;
            if (p.type === "reasoning" && p.state === "streaming") p.state = "completed";
            if (p.type === "tool" && p.state === "call") p.state = "result";
          }
        }
        this.finishCurrentRequestMetricForSession(session);
        session.status = "completed";
        this.saveSessionToDb(session);
        return;
      }

      // 3. 消息生命周期事件（精确区分 assistant, user 与 toolResult）
      if (event.type === "message_start") {
        const role = event.message?.role;
        if (role === "user") {
          // 用户消息：若会话尚未记录该提示词，则补齐；严禁当作 assistant 消息
          const contentText = typeof event.message.content === "string"
            ? event.message.content
            : (Array.isArray(event.message.content) ? event.message.content[0]?.text || "" : "");
          if (contentText && !session.messages.some((m) => m.role === "user" && m.content === contentText)) {
            session.messages.push({
              id: `msg-user-${Date.now()}`,
              role: "user",
              content: contentText,
              createdAt: Date.now(),
            });
          }
          return;
        }

        if (role === "toolResult") {
          // 工具结果消息：回填对应工具卡片，绝不创建新 Assistant 气泡与指标
          const toolId = event.message.toolCallId;
          if (toolId) {
            const found = this.findToolPartInSession(session, toolId);
            if (found && found.part.type === "tool" && !found.part.result) {
              found.part.state = "result";
              found.part.result = event.message.content;
              found.part.error = event.message.isError ? "工具执行失败" : undefined;
            }
          }
          return;
        }

        // 仅在 role === "assistant"（或无明确角色）时，才正式开启新的 LLM Assistant 消息与请求指标
        const assistantMsgId = `msg-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        session.messages.push({
          id: assistantMsgId,
          role: "assistant",
          content: "",
          parts: [],
          createdAt: Date.now(),
          isStreaming: true,
          toolInvocations: [],
        });
        this.startNewRequestMetricForSession(session);
        return;
      }

      if (event.type === "message_end") {
        const role = event.message?.role;
        if (role === "user" || role === "toolResult") {
          // 非 Assistant 消息结束，直接忽略
          return;
        }
        const assistantMsg = session.messages.find((m) => m.role === "assistant" && m.isStreaming);
        if (assistantMsg) {
          assistantMsg.isStreaming = false;
          for (const p of assistantMsg.parts || []) {
            if (p.type === "text") p.isStreaming = false;
            if (p.type === "reasoning" && p.state === "streaming") p.state = "completed";
          }
        }
        this.finishCurrentRequestMetricForSession(session);
        return;
      }

      // 4. 流式文本与思考更新 (message_update)
      if (event.type === "message_update") {
        let assistantMsg = session.messages.find((m) => m.role === "assistant" && m.isStreaming);
        if (!assistantMsg) {
          const assistantMsgId = `msg-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          session.messages.push({
            id: assistantMsgId,
            role: "assistant",
            content: "",
            parts: [],
            createdAt: Date.now(),
            isStreaming: true,
            toolInvocations: [],
          });
          assistantMsg = session.messages[session.messages.length - 1];
          this.startNewRequestMetricForSession(session);
        }
        if (!assistantMsg.parts) assistantMsg.parts = [];

        const sub = event.assistantMessageEvent;
        if (!sub) return;

        if (sub.type === "text_delta" || sub.type === "thinking_delta") {
          if (!session.currentRequestMetric) {
            this.startNewRequestMetricForSession(session);
          }
          if (session.currentRequestMetric && !session.currentRequestMetric.firstTokenTime) {
            session.currentRequestMetric.firstTokenTime = Date.now();
            session.currentRequestMetric.ttftMs = Math.max(1, session.currentRequestMetric.firstTokenTime - session.currentRequestMetric.startTime);
          }
          if (!session.metrics.firstTokenMs) {
            session.metrics.firstTokenMs = Math.max(1, Date.now() - session.createdAt);
          }
        }

        if (sub.type === "thinking_delta") {
          const delta = sub.delta || "";
          const parts = assistantMsg.parts;
          const lastPart = parts[parts.length - 1];
          if (lastPart && lastPart.type === "reasoning" && lastPart.state === "streaming") {
            lastPart.content += delta;
          } else {
            parts.push({
              id: `reasoning-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: "reasoning",
              content: delta,
              state: "streaming",
              collapsed: false,
              createdAt: Date.now(),
            });
          }
          if (!assistantMsg.reasoning) {
            assistantMsg.reasoning = { content: delta, state: "streaming", collapsed: false };
          } else {
            assistantMsg.reasoning.content += delta;
          }
          const added = estimateTokens(delta);
          if (!session.currentRequestMetric) this.startNewRequestMetricForSession(session);
          if (session.currentRequestMetric) {
            session.currentRequestMetric.completionTokens += added;
            this.updateSessionTps(session);
          }
        } else if (sub.type === "thinking_end") {
          const parts = assistantMsg.parts;
          for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            if (p.type === "reasoning" && p.state === "streaming") {
              p.state = "completed";
              p.collapsed = true;
              break;
            }
          }
          if (assistantMsg.reasoning) {
            assistantMsg.reasoning.state = "completed";
            assistantMsg.reasoning.collapsed = true;
          }
        } else if (sub.type === "toolcall_start") {
          const toolId = sub.id || sub.toolCall?.id || `tool-${Date.now()}`;
          const toolName = sub.toolName || sub.toolCall?.name || "tool";
          this.toolCallBuffers.set(toolId, { id: toolId, name: toolName, rawArgs: "" });
          if (session.currentRequestMetric) {
            session.currentRequestMetric.hasTools = true;
            if (!session.currentRequestMetric.toolNames.includes(toolName)) {
              session.currentRequestMetric.toolNames.push(toolName);
            }
          }
          const lastPart = assistantMsg.parts[assistantMsg.parts.length - 1];
          if (lastPart && lastPart.type === "text") {
            lastPart.isStreaming = false;
          }
        } else if (sub.type === "toolcall_delta") {
          const toolId = sub.id || sub.toolCall?.id;
          const buf = toolId ? this.toolCallBuffers.get(toolId) : Array.from(this.toolCallBuffers.values())[0];
          if (buf) buf.rawArgs += sub.delta || "";
        } else if (sub.type === "toolcall_end") {
          const toolId = sub.toolCall?.id || sub.id || Array.from(this.toolCallBuffers.keys())[0] || `tool-${Date.now()}`;
          const buf = this.toolCallBuffers.get(toolId);
          let parsedArgs = sub.toolCall?.arguments || {};
          if (Object.keys(parsedArgs).length === 0 && buf?.rawArgs) {
            try { parsedArgs = JSON.parse(buf.rawArgs); } catch { parsedArgs = { raw: buf.rawArgs }; }
          }
          const toolName = sub.toolCall?.name || buf?.name || "tool";
          const existingPartIndex = assistantMsg.parts.findIndex((p) => {
            if (p.type !== "tool") return false;
            const a = p.toolCallId;
            const b = toolId;
            return a === b || a.split("|").some((x) => b.split("|").includes(x)) || a.startsWith(b) || b.startsWith(a);
          });
          if (existingPartIndex === -1) {
            assistantMsg.parts.push({
              id: toolId,
              type: "tool",
              toolCallId: toolId,
              toolName,
              args: parsedArgs,
              state: "call",
              isCollapsed: true,
              createdAt: Date.now(),
            });
            session.metrics.toolCallsCount++;
          } else {
            const target = assistantMsg.parts[existingPartIndex] as any;
            target.args = parsedArgs;
            target.toolName = toolName;
          }
        } else if (sub.type === "text_delta") {
          const delta = sub.delta || "";
          assistantMsg.content += delta;
          const parts = assistantMsg.parts;
          const lastPart = parts[parts.length - 1];
          if (lastPart && lastPart.type === "text" && lastPart.isStreaming) {
            lastPart.content += delta;
          } else {
            parts.push({
              id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: "text",
              content: delta,
              isStreaming: true,
              createdAt: Date.now(),
            });
          }
          const added = estimateTokens(delta);
          if (!session.currentRequestMetric) this.startNewRequestMetricForSession(session);
          if (session.currentRequestMetric) {
            session.currentRequestMetric.completionTokens += added;
            this.updateSessionTps(session);
          }
        }
      }
    },

    async startSession(sessionId: string, customPrompt?: string) {
      const session = this.sessions[sessionId];
      if (!session) return;
      const providerStore = useProviderStore();
      const provider = providerStore.providers.find((p) => p.id === session.providerId);
      const task = this.tasks.find((t) => t.id === session.taskId) || this.tasks[0];
      const prompt = customPrompt || task.userPrompt;

      session.status = "preparing";
      await this.initGlobalRpcListener();

      try {
        const modelConfig = {
          id: session.modelId,
          providerId: session.providerId,
          apiKey: provider?.apiKey || "",
          baseUrl: provider?.baseUrl || "",
          api: provider?.api || "openai-completions",
          adapterId: (provider?.compat as any)?.adapterId || null,
          models: provider?.models || [],
        };
        const ws = await invoke<string>("create_test_workspace", {
          modelConfig,
          taskId: session.taskId,
        });
        session.workspaceDir = ws;
      } catch (err: any) {
        session.status = "failed";
        session.error = String(err);
        await this.saveSessionToDb(session);
        return;
      }

      if (session.messages.length === 0) {
        session.messages.push({
          id: `msg-user-${Date.now()}`,
          role: "user",
          content: prompt,
          createdAt: Date.now(),
        });
      }

      session.status = "running";
      await this.saveSessionToDb(session);

      try {
        const modelConfig = {
          id: session.modelId,
          providerId: session.providerId,
          apiKey: provider?.apiKey || "",
          baseUrl: provider?.baseUrl || "",
          api: provider?.api || "openai-completions",
          adapterId: (provider?.compat as any)?.adapterId || null,
          models: provider?.models || [],
        };
        await invoke("start_session_rpc", {
          sessionId: session.id,
          workspaceDir: session.workspaceDir,
          modelConfig,
          prompt,
        });
      } catch (err: any) {
        session.status = "failed";
        session.error = String(err);
        await this.saveSessionToDb(session);
      }
    },

    async continueSession(sessionId: string, customPrompt?: string) {
      const session = this.sessions[sessionId];
      if (!session) return;
      const prompt = customPrompt?.trim() || "请继续完成后续任务与验证并报告结果";

      session.messages.push({
        id: `msg-user-${Date.now()}`,
        role: "user",
        content: prompt,
        createdAt: Date.now(),
      });
      session.status = "running";
      await this.initGlobalRpcListener();

      try {
        await invoke("continue_session_rpc", {
          sessionId: session.id,
          prompt,
        });
      } catch (err: any) {
        console.warn(`[continue_session_rpc fallback] ${err}, restarting session RPC...`);
        const providerStore = useProviderStore();
        const provider = providerStore.providers.find((p) => p.id === session.providerId);
        const modelConfig = {
          id: session.modelId,
          providerId: session.providerId,
          apiKey: provider?.apiKey || "",
          baseUrl: provider?.baseUrl || "",
          api: provider?.api || "openai-completions",
          adapterId: (provider?.compat as any)?.adapterId || null,
          models: provider?.models || [],
        };
        await invoke("start_session_rpc", {
          sessionId: session.id,
          workspaceDir: session.workspaceDir,
          modelConfig,
          prompt,
        });
      }
      await this.saveSessionToDb(session);
    },

    async stopSession(sessionId: string) {
      const session = this.sessions[sessionId];
      if (!session) return;
      try {
        await invoke("abort_session_rpc", { sessionId });
      } catch (e) {
        console.error(e);
      }
      session.status = "stopped";
      for (const m of session.messages) {
        if (m.isStreaming) m.isStreaming = false;
      }
      await this.saveSessionToDb(session);
    },

    async stopAllSessions() {
      try {
        await invoke("abort_session_rpc", {});
      } catch (e) {
        console.error(e);
      }
      for (const s of Object.values(this.sessions)) {
        if (s.status === "running" || s.status === "preparing") {
          s.status = "stopped";
          for (const m of s.messages) {
            if (m.isStreaming) m.isStreaming = false;
          }
          this.saveSessionToDb(s);
        }
      }
    },

    async batchLaunch(config: {
      taskId: string;
      targets: BatchModelTarget[];
      layoutMode: WorkbenchLayoutMode;
      concurrency: number;
      customPrompt?: string;
    }) {
      const task = this.tasks.find((t) => t.id === config.taskId) || this.tasks[0];
      const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const groupName = `${task.name} (${config.targets.length} 模型测试)`;

      const newGroup: TestGroup = {
        id: groupId,
        name: groupName,
        taskId: config.taskId,
        layoutMode: config.layoutMode,
        concurrencyLimit: config.concurrency,
        sessionIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const createdSessionIds: string[] = [];

      for (let i = 0; i < config.targets.length; i++) {
        const target = config.targets[i];
        const sid = `ses-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
        const session: TestSession = {
          id: sid,
          groupId: groupId,
          taskId: config.taskId,
          providerId: target.providerId,
          modelId: target.modelId,
          providerName: target.providerName,
          modelName: target.modelName,
          status: "idle",
          messages: [
            {
              id: `msg-user-${Date.now()}`,
              role: "user",
              content: config.customPrompt || task.userPrompt,
              createdAt: Date.now(),
            },
          ],
          metrics: {
            totalDurationMs: 0,
            firstTokenMs: 0,
            totalTokens: 0,
            completionTokens: 0,
            tps: 0,
            tpsWithTtft: 0,
            tpsWithoutTtft: 0,
            toolCallsCount: 0,
            requestMetrics: [],
          },
          slotIndex: i,
          createdAt: Date.now() + i,
          updatedAt: Date.now() + i,
        };
        this.sessions[sid] = session;
        createdSessionIds.push(sid);
        await this.saveSessionToDb(session);
      }

      newGroup.sessionIds = createdSessionIds;
      this.groups.unshift(newGroup);
      await this.saveGroupToDb(newGroup);

      this.activeGroupId = groupId;
      this.layoutMode = config.layoutMode;
      this.activeSlotSessionIds = [...createdSessionIds];
      this.focusedSlotIndex = 0;

      const concurrency = Math.max(1, config.concurrency || 4);
      const queue = [...createdSessionIds];

      const runNext = async () => {
        if (queue.length === 0) return;
        const sid = queue.shift()!;
        await this.startSession(sid, config.customPrompt);
        await runNext();
      };

      const runners = Array.from({ length: Math.min(concurrency, queue.length) }, () => runNext());
      Promise.all(runners).catch(console.error);
    },

    /**
     * 强制从后端重新加载测试任务模板
     */
    async reloadTasks() {

      try {
        const tasks: TestTask[] = await invoke("get_test_tasks");
        const previousActiveId = this.activeTaskId;
        this.tasks = tasks.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category as TaskCategory,
          userPrompt: t.userPrompt,
          systemPrompt: t.systemPrompt || undefined,
          order: t.order,
          allowNet: t.allowNet,
          expectedOutputs: t.expectedOutputs,
          plan: t.plan || undefined,
          docs: t.docs || [],
          status: "idle" as const,
        }));

        if (this.tasks.length === 0) {
          throw new Error("后端未返回任何任务模板");
        }

        const stillExists = this.tasks.some((t) => t.id === previousActiveId);
        this.activeTaskId = stillExists ? previousActiveId : this.tasks[0].id;

        this.tasksLoaded = true;
        this.initTaskMessages();
      } catch (err) {
        console.error("加载测试任务失败，使用默认任务", err);
        // 降级到默认任务
        this.tasks = JSON.parse(JSON.stringify(DEFAULT_TEST_TASKS)) as TestTask[];
        if (!this.activeTaskId && this.tasks.length > 0) {
          this.activeTaskId = this.tasks[0].id;
        }
        this.tasksLoaded = true;
      }
    },

    /**
     * 切换当前选中的测试任务
     */
    async selectTask(taskId: string) {
      // 确保任务已加载
      if (!this.tasksLoaded) {
        await this.loadTasks();
      }

      if (this.isRunning) {
        this.stopTest();
      }

      if (this.activeTaskId && this.messages.length > 0) {
        this.taskHistory[this.activeTaskId] = JSON.parse(JSON.stringify(this.messages));
      }

      this.activeTaskId = taskId;
      this.executionState = "idle";

      if (this.taskHistory[taskId] && this.taskHistory[taskId].length > 0) {
        this.messages = JSON.parse(JSON.stringify(this.taskHistory[taskId]));
      } else {
        this.initTaskMessages();
      }

      const task = this.activeTask;
      if (task.lastMetrics) {
        this.metrics = {
          totalDurationMs: task.lastMetrics.totalDurationMs,
          firstTokenMs: task.lastMetrics.firstTokenMs,
          totalTokens: task.lastMetrics.totalTokens,
          completionTokens: task.lastMetrics.totalTokens,
          tps: task.lastMetrics.tps,
          tpsWithTtft: task.lastMetrics.tps,
          tpsWithoutTtft: task.lastMetrics.tps,
          toolCallsCount: 0,
          requestMetrics: [],
        };
      } else {
        this.resetMetrics();
      }
    },

    /**
     * 初始化任务预览消息（显示 User Prompt、计划文档和资料列表）
     */
    initTaskMessages() {
      const task = this.activeTask;
      const initialMessages: UIMessage[] = [];

      if (task.systemPrompt) {
        initialMessages.push({
          id: `msg-system-${task.id}`,
          role: "system",
          content: task.systemPrompt,
          createdAt: Date.now(),
        });
      }

      initialMessages.push({
        id: `msg-user-${task.id}`,
        role: "user",
        content: task.userPrompt,
        createdAt: Date.now(),
      });

      this.messages = initialMessages;
    },

    resetMetrics() {
      this.metrics = {
        totalDurationMs: 0,
        firstTokenMs: 0,
        totalTokens: 0,
        completionTokens: 0,
        tps: 0,
        tpsWithTtft: 0,
        tpsWithoutTtft: 0,
        toolCallsCount: 0,
        requestMetrics: [],
      };
      this.currentRequestMetric = null;
      this.requestCounter = 0;
      this.firstTokenRecorded = false;
    },

    startNewRequestMetric() {
      if (this.currentRequestMetric) {
        this.finalizeCurrentRequestMetric("completed");
      }
      this.requestCounter++;
      this.currentRequestMetric = {
        id: `req-${this.requestCounter}`,
        index: this.requestCounter,
        role: "assistant",
        startTime: Date.now(),
        ttftMs: 0,
        durationMs: 0,
        completionTokens: 0,
        tpsWithTtft: 0,
        tpsWithoutTtft: 0,
        hasTools: false,
        toolNames: [],
        status: "streaming",
      };
    },

    updateCurrentRequestTps() {
      if (!this.currentRequestMetric) return;
      const req = this.currentRequestMetric;
      const durSec = (Date.now() - req.startTime) / 1000;
      if (durSec > 0 && req.completionTokens > 0) {
        req.tpsWithTtft = Math.round((req.completionTokens / durSec) * 10) / 10;
      }
      const decSec = req.firstTokenTime ? (Date.now() - req.firstTokenTime) / 1000 : 0;
      if (decSec > 0.05 && req.completionTokens > 1) {
        req.tpsWithoutTtft = Math.round(((req.completionTokens - 1) / decSec) * 10) / 10;
      } else {
        req.tpsWithoutTtft = req.tpsWithTtft;
      }
    },

    finalizeCurrentRequestMetric(status: "completed" | "error" = "completed") {
      if (!this.currentRequestMetric) return;
      const req = this.currentRequestMetric;
      req.endTime = Date.now();
      req.durationMs = Math.max(req.endTime - req.startTime, req.ttftMs || 1);
      req.status = status;
      const durSec = req.durationMs / 1000;
      if (durSec > 0 && req.completionTokens > 0) {
        req.tpsWithTtft = Math.round((req.completionTokens / durSec) * 10) / 10;
      }
      const decSec = req.firstTokenTime ? (req.endTime - req.firstTokenTime) / 1000 : 0;
      if (decSec > 0.05 && req.completionTokens > 1) {
        req.tpsWithoutTtft = Math.round(((req.completionTokens - 1) / decSec) * 10) / 10;
      } else {
        req.tpsWithoutTtft = req.tpsWithTtft;
      }
      this.metrics.requestMetrics.push({ ...req });
      this.currentRequestMetric = null;
      this.recalculateAggregateMetrics();
    },

    recalculateAggregateMetrics() {
      const list = this.metrics.requestMetrics;
      if (list.length === 0) return;
      const totalComp = list.reduce((acc, r) => acc + r.completionTokens, 0);
      const totalDurSec = list.reduce((acc, r) => acc + r.durationMs, 0) / 1000;
      const totalDecSec = list.reduce((acc, r) => acc + Math.max(0, r.durationMs - r.ttftMs), 0) / 1000;
      if (totalDurSec > 0 && totalComp > 0) {
        this.metrics.tpsWithTtft = Math.round((totalComp / totalDurSec) * 10) / 10;
        this.metrics.tps = this.metrics.tpsWithTtft;
      }
      if (totalDecSec > 0.05 && totalComp > list.length) {
        this.metrics.tpsWithoutTtft = Math.round(((totalComp - list.length) / totalDecSec) * 10) / 10;
      } else {
        this.metrics.tpsWithoutTtft = this.metrics.tpsWithTtft;
      }
    },

    resetCurrentTask() {
      if (this.isRunning) {
        this.stopTest();
      }
      this.executionState = "idle";
      this.resetMetrics();
      this.initTaskMessages();
      delete this.taskHistory[this.activeTaskId];
      const task = this.activeTask;
      task.status = "idle";
    },

    /**
     * 处理 Pi Coding Agent 官方 RPC 输出事件
     */
    handleRpcEvent(rawLine: string) {
      if (!rawLine || !rawLine.trim()) return;
      let event: any;
      try {
        event = JSON.parse(rawLine);
      } catch {
        return;
      }

      // 获取当前正在流式的 Assistant 消息代理
      let assistantMsg = this.messages.find(
        (m) => m.role === "assistant" && m.isStreaming
      );
      if (!assistantMsg && (event.type === "message_start" || event.type === "message_update")) {
        const assistantMsgId = `msg-assistant-${Date.now()}`;
        this.messages.push({
          id: assistantMsgId,
          role: "assistant",
          content: "",
          parts: [], // ★ 初始化时间线内容块列表
          createdAt: Date.now(),
          isStreaming: true,
          reasoning: undefined,
          toolInvocations: [],
        });
        assistantMsg = this.messages[this.messages.length - 1];
        this.startNewRequestMetric();
      }

      if (!assistantMsg) return;
      if (!assistantMsg.parts) assistantMsg.parts = [];

      // 记录首字延迟
      if (
        event.assistantMessageEvent?.type === "text_delta" ||
        event.assistantMessageEvent?.type === "thinking_delta"
      ) {
        if (!this.currentRequestMetric) {
          this.startNewRequestMetric();
        }
        if (this.currentRequestMetric && !this.currentRequestMetric.firstTokenTime) {
          this.currentRequestMetric.firstTokenTime = Date.now();
          this.currentRequestMetric.ttftMs = Math.max(1, this.currentRequestMetric.firstTokenTime - this.currentRequestMetric.startTime);
        }
        if (!this.firstTokenRecorded) {
          this.firstTokenRecorded = true;
          this.metrics.firstTokenMs = Math.round(performance.now() - this.runStartTime);
        }
      }

      // 关键事件日志打印
      if (
        event.type === "agent_start" ||
        event.type === "agent_settled" ||
        event.type === "response" ||
        event.type === "tool_execution_start" ||
        event.type === "tool_execution_end"
      ) {
        console.log(`[Pi RPC Event: ${event.type}]`, event);
      }

      // 处理命令级响应 (如 Prompt 报错、Provider 异常)
      if (event.type === "response") {
        if (!event.success) {
          console.error("[Pi RPC Command Failed]", event.command, event.error);
          this.executionState = "error";
          const task = this.activeTask;
          task.status = "failed";
          const errMsg = `[提供商/模型执行异常]: ${event.error || "未知错误"}`;
          assistantMsg.content = errMsg;
          assistantMsg.isStreaming = false;
          assistantMsg.parts.push({
            id: `err-${Date.now()}`,
            type: "text",
            content: errMsg,
            isStreaming: false,
            createdAt: Date.now(),
          });
        }
        return;
      }

      // 深度检查事件中携带的 message 异常信息 (例如 401 余额不足、404 模型不存在等)
      const msgObj = event.message || (Array.isArray(event.messages) ? event.messages.find((m: any) => m.errorMessage || m.stopReason === "error") : null);
      if (msgObj && (msgObj.stopReason === "error" || msgObj.errorMessage)) {
        const errDetail = msgObj.errorMessage || "模型调用发生异常";
        console.error("[Pi Model Error]", errDetail);
        this.executionState = "error";
        this.activeTask.status = "failed";
        const errMsg = `❌ [提供商/模型异常]: ${errDetail}`;
        assistantMsg.content = errMsg;
        assistantMsg.isStreaming = false;
        const lastPart = assistantMsg.parts[assistantMsg.parts.length - 1];
        if (!lastPart || lastPart.type !== "text" || lastPart.content !== errMsg) {
          assistantMsg.parts.push({
            id: `err-${Date.now()}`,
            type: "text",
            content: errMsg,
            isStreaming: false,
            createdAt: Date.now(),
          });
        }
      }

      switch (event.type) {
        case "message_update": {
          const sub = event.assistantMessageEvent;
          if (!sub) break;

          // 1. 深度思考推理流 (Reasoning / Thinking Part)
          if (sub.type === "thinking_delta") {
            this.executionState = "streaming_reasoning";
            const delta = sub.delta || "";
            const parts = assistantMsg.parts;
            const lastPart = parts[parts.length - 1];

            if (lastPart && lastPart.type === "reasoning" && lastPart.state === "streaming") {
              lastPart.content += delta;
            } else {
              parts.push({
                id: `reasoning-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: "reasoning",
                content: delta,
                state: "streaming",
                collapsed: false,
                createdAt: Date.now(),
              });
            }

            // 同步向后兼容
            if (!assistantMsg.reasoning) {
              assistantMsg.reasoning = {
                content: delta,
                state: "streaming",
                collapsed: false,
              };
            } else {
              assistantMsg.reasoning.content += delta;
            }
            const added = estimateTokens(delta);
            this.metrics.totalTokens += added;
            if (!this.currentRequestMetric) this.startNewRequestMetric();
            if (this.currentRequestMetric) {
              this.currentRequestMetric.completionTokens += added;
              this.updateCurrentRequestTps();
            }
          } else if (sub.type === "thinking_end") {
            const parts = assistantMsg.parts;
            for (let i = parts.length - 1; i >= 0; i--) {
              const p = parts[i];
              if (p.type === "reasoning" && p.state === "streaming") {
                p.state = "completed";
                p.collapsed = true;
                break;
              }
            }
            if (assistantMsg.reasoning) {
              assistantMsg.reasoning.state = "completed";
              assistantMsg.reasoning.collapsed = true;
            }
          }

          // 2. 工具调用体缓冲与闭合 (Tool Part 按时间线插入)
          else if (sub.type === "toolcall_start") {
            const toolId = sub.id || sub.toolCall?.id || `tool-${Date.now()}`;
            const toolName = sub.toolName || sub.toolCall?.name || "tool";
            this.executionState = "calling_tool";
            this.toolCallBuffers.set(toolId, {
              id: toolId,
              name: toolName,
              rawArgs: "",
            });
            if (this.currentRequestMetric) {
              this.currentRequestMetric.hasTools = true;
              if (!this.currentRequestMetric.toolNames.includes(toolName)) {
                this.currentRequestMetric.toolNames.push(toolName);
              }
            }
            // 闭合前一个正在流式输出的文本块光标
            const lastPart = assistantMsg.parts[assistantMsg.parts.length - 1];
            if (lastPart && lastPart.type === "text") {
              lastPart.isStreaming = false;
            }
          } else if (sub.type === "toolcall_delta") {
            const toolId = sub.id || sub.toolCall?.id;
            const buf = toolId ? this.toolCallBuffers.get(toolId) : Array.from(this.toolCallBuffers.values())[0];
            if (buf) {
              buf.rawArgs += sub.delta || "";
            }
          } else if (sub.type === "toolcall_end") {
            // ★ 核心规范：调用体接收完毕立即独立渲染该工具项！严格默认折叠！
            const toolId = sub.toolCall?.id || sub.id || Array.from(this.toolCallBuffers.keys())[0] || `tool-${Date.now()}`;
            const buf = this.toolCallBuffers.get(toolId);
            let parsedArgs = sub.toolCall?.arguments || {};
            if (Object.keys(parsedArgs).length === 0 && buf?.rawArgs) {
              try {
                parsedArgs = JSON.parse(buf.rawArgs);
              } catch {
                parsedArgs = { raw: buf.rawArgs };
              }
            }

            const toolName = sub.toolCall?.name || buf?.name || "tool";

            // (1) 时间线 parts 插入/更新
            const existingPartIndex = assistantMsg.parts.findIndex(
              (p) => p.type === "tool" && p.toolCallId === toolId
            );
            if (existingPartIndex === -1) {
              assistantMsg.parts.push({
                id: toolId,
                type: "tool",
                toolCallId: toolId,
                toolName,
                args: parsedArgs,
                state: "call",
                isCollapsed: true, // 默认折叠
                createdAt: Date.now(),
              });
              this.metrics.toolCallsCount++;
            } else {
              const target = assistantMsg.parts[existingPartIndex] as any;
              target.args = parsedArgs;
              target.toolName = toolName;
            }

            // (2) 同步向后兼容 toolInvocations
            if (!assistantMsg.toolInvocations) {
              assistantMsg.toolInvocations = [];
            }
            const exists = assistantMsg.toolInvocations.find((t) => t.toolCallId === toolId);
            if (!exists) {
              assistantMsg.toolInvocations.push({
                toolCallId: toolId,
                toolName,
                args: parsedArgs,
                state: "call",
                isCollapsed: true,
              });
            } else {
              exists.args = parsedArgs;
              exists.toolName = toolName;
            }
            this.toolCallBuffers.delete(toolId);
          }

          // 3. 正文流式打字 (Text Part 按时间线插入)
          else if (sub.type === "text_delta") {
            this.executionState = "streaming_text";
            const delta = sub.delta || "";
            const parts = assistantMsg.parts;
            const lastPart = parts[parts.length - 1];

            if (lastPart && lastPart.type === "text" && lastPart.isStreaming) {
              lastPart.content += delta;
            } else {
              parts.push({
                id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: "text",
                content: delta,
                isStreaming: true,
                createdAt: Date.now(),
              });
            }

            // 同步向后兼容完整正文
            assistantMsg.content += delta;
            const added = estimateTokens(delta);
            this.metrics.totalTokens += added;
            this.metrics.completionTokens += added;
            if (!this.currentRequestMetric) this.startNewRequestMetric();
            if (this.currentRequestMetric) {
              this.currentRequestMetric.completionTokens += added;
              this.updateCurrentRequestTps();
            }
          }
          break;
        }

        // 4. 工具实际执行更新与结果回填 (按 toolCallId 定位就地更新)
        case "tool_execution_start": {
          this.executionState = "calling_tool";
          this.finalizeCurrentRequestMetric("completed");
          const targetId = event.toolCallId || event.id;

          // (1) 时间线 parts 更新
          const targetPart = assistantMsg.parts.find(
            (p) => p.type === "tool" && p.toolCallId === targetId
          ) as any;
          if (targetPart) {
            if (event.args && Object.keys(event.args).length > 0) {
              targetPart.args = event.args;
            }
          } else {
            assistantMsg.parts.push({
              id: targetId,
              type: "tool",
              toolCallId: targetId,
              toolName: event.toolName || "tool",
              args: event.args || {},
              state: "call",
              isCollapsed: true,
              createdAt: Date.now(),
            });
            this.metrics.toolCallsCount++;
          }

          // (2) 同步向后兼容
          if (!assistantMsg.toolInvocations) {
            assistantMsg.toolInvocations = [];
          }
          const existing = assistantMsg.toolInvocations.find((t) => t.toolCallId === targetId);
          if (!existing) {
            assistantMsg.toolInvocations.push({
              toolCallId: targetId,
              toolName: event.toolName || "tool",
              args: event.args || {},
              state: "call",
              isCollapsed: true,
            });
          } else {
            if (event.args && Object.keys(event.args).length > 0) {
              existing.args = event.args;
            }
          }
          break;
        }

        case "tool_execution_end": {
          const targetId = event.toolCallId || event.id;

          // (1) 时间线 parts 就地更新结果
          const targetPart = assistantMsg.parts.find(
            (p) => p.type === "tool" && p.toolCallId === targetId
          ) as any;
          if (targetPart) {
            targetPart.state = "result";
            targetPart.result = event.result;
          } else {
            // 兜底找最后一个待处理的 tool part
            for (let i = assistantMsg.parts.length - 1; i >= 0; i--) {
              const p = assistantMsg.parts[i] as any;
              if (p.type === "tool" && p.state === "call") {
                p.state = "result";
                p.result = event.result;
                if (targetId) p.toolCallId = targetId;
                break;
              }
            }
          }

          // (2) 同步向后兼容
          if (assistantMsg.toolInvocations) {
            const target = assistantMsg.toolInvocations.find((t) => t.toolCallId === targetId);
            if (target) {
              target.state = "result";
              target.result = event.result;
            } else if (assistantMsg.toolInvocations.length > 0) {
              const pending = assistantMsg.toolInvocations.find((t) => t.state === "call");
              if (pending) {
                pending.state = "result";
                pending.result = event.result;
                if (targetId) pending.toolCallId = targetId;
              }
            }
          }
          break;
        }

        // 5. 结算与结束
        case "agent_settled":
        case "agent_end": {
          assistantMsg.isStreaming = false;
          // 结束所有 text part 的流式光标
          for (const p of assistantMsg.parts) {
            if (p.type === "text") {
              p.isStreaming = false;
            }
          }

          const hasError = this.executionState === "error" || (msgObj && (msgObj.stopReason === "error" || msgObj.errorMessage));
          const task = this.activeTask;

          if (hasError) {
            this.executionState = "error";
            task.status = "failed";
            if (!assistantMsg.content && msgObj?.errorMessage) {
              const errText = `❌ [提供商/模型异常]: ${msgObj.errorMessage}`;
              assistantMsg.content = errText;
              assistantMsg.parts.push({
                id: `err-${Date.now()}`,
                type: "text",
                content: errText,
                isStreaming: false,
                createdAt: Date.now(),
              });
            }
          } else {
            this.executionState = "completed";
            task.status = "success";
          }

          this.finalizeCurrentRequestMetric(hasError ? "error" : "completed");
          this.recalculateAggregateMetrics();

          this.metrics.totalDurationMs = Math.round(performance.now() - this.runStartTime);
          task.lastMetrics = {
            totalDurationMs: this.metrics.totalDurationMs,
            firstTokenMs: this.metrics.firstTokenMs,
            totalTokens: this.metrics.totalTokens,
            tps: this.metrics.tpsWithTtft,
          };
          this.taskHistory[this.activeTaskId] = JSON.parse(JSON.stringify(this.messages));
          break;
        }

        case "runner_error": {
          console.error("[Pi Agent Runner Error]", event.text);
          this.executionState = "error";
          this.activeTask.status = "failed";
          const lastMessage = this.messages[this.messages.length - 1];
          if (lastMessage?.role === "assistant") {
            lastMessage.content = `[执行异常]: ${event.text}`;
            lastMessage.isStreaming = false;
          }
          if (this.metricsTimer) { clearInterval(this.metricsTimer); this.metricsTimer = null; }
          break;
        }

        case "stderr_log": {
          console.warn("[Pi Agent Stderr]", event.text);
          break;
        }
      }
    },

    /**
     * 启动测试：创建真实沙箱目录 -> 拉起 pi --mode rpc 进程 -> 监听流式事件
     */
    async startTest() {
      if (this.isRunning) return;

      const task = this.activeTask;
      task.status = "running";
      task.lastRunAt = Date.now();

      this.executionState = "preparing_workspace";
      this.resetMetrics();
      this.initTaskMessages();
      this.toolCallBuffers.clear();

      const modelTarget = this.currentModelDisplay;
      const providerStore = useProviderStore();
      const targetProvider = providerStore.providers.find((p) => p.id === modelTarget.providerId);
      const targetModel = targetProvider?.models?.find((m) => m.id === modelTarget.modelId);
      const adapterPolicy = targetProvider && targetModel ? resolveAdapterPolicy(targetProvider, targetModel) : undefined;
      const modelConfig = {
        id: modelTarget.modelId,
        providerId: modelTarget.providerId,
        apiKey: targetProvider?.apiKey || "",
        baseUrl: targetModel?.baseUrl || targetProvider?.baseUrl || "",
        api: targetModel?.api || targetProvider?.api || "openai-completions",
        headers: targetProvider?.headers || {},
        compat: targetProvider?.compat || {},
        appliedPreset: targetModel?.appliedPreset || "",
        providerAppliedPreset: targetProvider?.appliedPreset || "",
        adapterId: adapterPolicy?.adapterId || "",
        models: targetProvider?.models || [],
      };

      try {
        // 1. 创建沙箱工作空间（传入 task_id）
        const wsDir: string = await invoke("create_test_workspace", {
          modelConfig,
          taskId: task.id,
        });
        this.currentWorkspaceDir = wsDir;
        task.workspaceDir = wsDir;

        // 2. 绑定 Tauri 事件监听（复用全局唯一单例）
        await this.initGlobalRpcListener();

        // 3. 启动计时器
        this.runStartTime = performance.now();
        this.startNewRequestMetric();
        if (this.metricsTimer) clearInterval(this.metricsTimer);
        this.metricsTimer = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(this.metricsTimer);
            return;
          }
          this.metrics.totalDurationMs = Math.round(performance.now() - this.runStartTime);
          this.updateCurrentRequestTps();
          this.recalculateAggregateMetrics();
        }, 100);

        // 4. 创建空的 Assistant 消息卡片
        const assistantMsgId = `msg-assistant-${Date.now()}`;
        this.messages.push({
          id: assistantMsgId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
          isStreaming: true,
          reasoning: undefined,
          toolInvocations: [],
        });

        this.executionState = "running_agent";

        // 5. 调用后端启动 RPC 双工子进程
        await invoke("start_pi_agent_rpc", {
          workspaceDir: wsDir,
          modelConfig,
          prompt: [
            task.userPrompt,
            "\n\n执行上下文（必须遵守）：",
            "先阅读 task/prompt.md；如存在 task/plan.md 和 task/docs/，必须阅读后再执行。",
            "所有生成代码写入 output/，所有日志写入 test_log.json 或 logs/，最终报告写入 test_summary.txt。",
            task.expectedOutputs?.length ? `期望产出：${task.expectedOutputs.join(", ")}` : "",
          ].filter(Boolean).join("\n"),
        });
      } catch (err: any) {
        console.error("启动测试失败", err);
        this.executionState = "error";
        task.status = "failed";
        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.content = `[执行异常]: ${err?.message || String(err)}`;
          lastMsg.isStreaming = false;
        }
      }
    },

    /**
     * 终止执行
     */
    async stopTest() {
      try {
        await invoke("abort_pi_agent_rpc");
      } catch (e) {
        console.warn("终止 RPC 异常", e);
      }

      this.executionState = "stopped";
      const task = this.activeTask;
      task.status = "stopped";

      const lastMsg = this.messages[this.messages.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        lastMsg.isStreaming = false;
      }

      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
        this.metricsTimer = null;
      }

      this.taskHistory[this.activeTaskId] = JSON.parse(JSON.stringify(this.messages));
    },

    /**
     * 在系统资源管理器中打开当前工作空间
     */
    async openCurrentWorkspace() {
      if (!this.currentWorkspaceDir) return;
      try {
        await invoke("open_workspace_in_explorer", {
          workspaceDir: this.currentWorkspaceDir,
        });
      } catch (err) {
        console.error("打开目录失败", err);
      }
    },

    /**
     * 新建测试任务
     */
    addTask(taskData: Omit<TestTask, "id" | "status">) {
      const newId = `task-custom-${Date.now()}`;
      const newTask: TestTask = {
        ...taskData,
        id: newId,
        status: "idle",
      };
      this.tasks.unshift(newTask);
      this.selectTask(newId);
    },

    deleteTask(taskId: string) {
      const idx = this.tasks.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        this.tasks.splice(idx, 1);
        delete this.taskHistory[taskId];
        if (this.activeTaskId === taskId) {
          const nextTask = this.tasks[0] || DEFAULT_TEST_TASKS[0];
          this.selectTask(nextTask.id);
        }
      }
    },

    /**
     * 批量模型评测调度控制
     */
    async startBatchTest(targets: BatchModelTarget[]) {
      if (this.isRunning || targets.length === 0) return;
      this.isBatchMode = true;
      this.batchTargets = targets;
      this.batchCards = targets.map((t) => ({
        id: `${t.providerId}::${t.modelId}`,
        target: t,
        status: "queued" as const,
        metrics: {
          totalDurationMs: 0,
          firstTokenMs: 0,
          totalTokens: 0,
          completionTokens: 0,
          tpsWithTtft: 0,
          tpsWithoutTtft: 0,
          toolCallsCount: 0,
        },
        liveLogs: ["已加入评测队列，等待调度..."],
        toolNames: [],
      }));
      this.batchQueueIndex = 0;
      this.isBatchRunning = true;
      await this.runBatchQueueNext();
    },

    async runBatchQueueNext() {
      if (!this.isBatchRunning || this.batchQueueIndex >= this.batchCards.length) {
        this.isBatchRunning = false;
        return;
      }

      const card = this.batchCards[this.batchQueueIndex];
      card.status = "running";
      card.startTime = Date.now();
      card.liveLogs.push(`启动评测沙箱 (${card.target.providerName} - ${card.target.modelName})...`);

      this.selectedProviderId = card.target.providerId;
      this.selectedModelId = card.target.modelId;

      try {
        await this.startTest();

        const checkInterval = setInterval(async () => {
          if (!this.isRunning) {
            clearInterval(checkInterval);
            card.status = this.executionState === "completed" ? "completed" : "failed";
            card.endTime = Date.now();
            card.workspaceDir = this.currentWorkspaceDir;
            card.metrics = {
              totalDurationMs: this.metrics.totalDurationMs,
              firstTokenMs: this.metrics.firstTokenMs,
              totalTokens: this.metrics.totalTokens,
              completionTokens: this.metrics.completionTokens,
              tpsWithTtft: this.metrics.tpsWithTtft,
              tpsWithoutTtft: this.metrics.tpsWithoutTtft,
              toolCallsCount: this.metrics.toolCallsCount,
            };
            card.liveLogs.push(
              card.status === "completed"
                ? `测试完成：含首字 ${card.metrics.tpsWithTtft} tps，不含首字 ${card.metrics.tpsWithoutTtft} tps`
                : `测试异常结束：${this.executionState}`
            );
            this.batchQueueIndex++;
            await this.runBatchQueueNext();
          } else {
            card.metrics.totalDurationMs = this.metrics.totalDurationMs;
            card.metrics.firstTokenMs = this.metrics.firstTokenMs;
            card.metrics.completionTokens = this.metrics.completionTokens;
            card.metrics.tpsWithTtft = this.metrics.tpsWithTtft;
            card.metrics.tpsWithoutTtft = this.metrics.tpsWithoutTtft;
            const lastMsg = this.messages[this.messages.length - 1];
            if (lastMsg) {
              const lastPart = lastMsg.parts?.[lastMsg.parts.length - 1];
              if (lastPart?.type === "tool") {
                card.currentActionText = `工具调用: ${lastPart.toolName}`;
                if (!card.toolNames.includes(lastPart.toolName)) card.toolNames.push(lastPart.toolName);
              } else if (lastPart?.type === "reasoning") {
                card.currentActionText = `推理: ${lastPart.content.slice(-40).trim()}`;
              } else if (lastPart?.type === "text") {
                card.currentActionText = `输出: ${lastPart.content.slice(-40).trim()}`;
              }
            }
          }
        }, 300);
      } catch (err: any) {
        card.status = "failed";
        card.error = err?.message || String(err);
        card.liveLogs.push(`执行失败: ${card.error}`);
        this.batchQueueIndex++;
        await this.runBatchQueueNext();
      }
    },

    stopBatchTest() {
      this.isBatchRunning = false;
      this.stopTest();
      for (let i = this.batchQueueIndex; i < this.batchCards.length; i++) {
        if (this.batchCards[i].status === "queued" || this.batchCards[i].status === "running") {
          this.batchCards[i].status = "stopped";
          this.batchCards[i].liveLogs.push("用户手动中止批量测试");
        }
      }
    },

    exitBatchMode() {
      if (this.isBatchRunning) {
        this.stopBatchTest();
      }
      this.isBatchMode = false;
    },
  },
});
