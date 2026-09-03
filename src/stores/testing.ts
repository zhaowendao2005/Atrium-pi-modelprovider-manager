import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ExecutionState,
  TaskCategory,
  TestTask,
  TestMetrics,
  UIMessage,
  ToolInvocationState,
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

export const useTestingStore = defineStore("testing", {
  state: () => ({
    // 测试任务库
    tasks: JSON.parse(JSON.stringify(DEFAULT_TEST_TASKS)) as TestTask[],
    activeTaskId: "task-availability" as string,

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

    // 性能指标面板
    metrics: {
      totalDurationMs: 0,
      firstTokenMs: 0,
      totalTokens: 0,
      completionTokens: 0,
      tps: 0,
      toolCallsCount: 0,
    } as TestMetrics,

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
  },

  actions: {
    /**
     * 切换当前选中的测试任务
     */
    selectTask(taskId: string) {
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
          toolCallsCount: 0,
        };
      } else {
        this.resetMetrics();
      }
    },

    /**
     * 初始化任务预览消息（显示 User Prompt）
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
        toolCallsCount: 0,
      };
      this.firstTokenRecorded = false;
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
      }

      if (!assistantMsg) return;
      if (!assistantMsg.parts) assistantMsg.parts = [];

      // 记录首字延迟
      if (
        !this.firstTokenRecorded &&
        (event.assistantMessageEvent?.type === "text_delta" ||
          event.assistantMessageEvent?.type === "thinking_delta")
      ) {
        this.firstTokenRecorded = true;
        this.metrics.firstTokenMs = Math.round(performance.now() - this.runStartTime);
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
            this.metrics.totalTokens += estimateTokens(delta);
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
            this.executionState = "calling_tool";
            this.toolCallBuffers.set(toolId, {
              id: toolId,
              name: sub.toolName || sub.toolCall?.name || "tool",
              rawArgs: "",
            });
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
          }
          break;
        }

        // 4. 工具实际执行更新与结果回填 (按 toolCallId 定位就地更新)
        case "tool_execution_start": {
          this.executionState = "calling_tool";
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

          const elapsedSec = (performance.now() - this.runStartTime) / 1000;
          this.metrics.totalDurationMs = Math.round(performance.now() - this.runStartTime);
          if (elapsedSec > 0 && this.metrics.completionTokens > 0) {
            this.metrics.tps = Math.round((this.metrics.completionTokens / elapsedSec) * 10) / 10;
          }
          task.lastMetrics = {
            totalDurationMs: this.metrics.totalDurationMs,
            firstTokenMs: this.metrics.firstTokenMs,
            totalTokens: this.metrics.totalTokens,
            tps: this.metrics.tps,
          };
          this.taskHistory[this.activeTaskId] = JSON.parse(JSON.stringify(this.messages));
          break;
        }

        case "stderr_log": {
          // 调试警告信息，不干扰正文流
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
      const modelConfig = {
        id: modelTarget.modelId,
        providerId: modelTarget.providerId,
        apiKey: targetProvider?.apiKey || "",
        baseUrl: targetProvider?.baseUrl || "",
        api: targetProvider?.api || "openai-completions",
        models: targetProvider?.models || [],
      };

      try {
        // 1. 创建沙箱工作空间
        const wsDir: string = await invoke("create_test_workspace", {
          modelConfig,
        });
        this.currentWorkspaceDir = wsDir;
        task.workspaceDir = wsDir;

        // 2. 绑定 Tauri 事件监听
        if (this.unlistenRpc) {
          this.unlistenRpc();
          this.unlistenRpc = null;
        }

        this.unlistenRpc = await listen("pi-rpc-event", (event: { payload: string }) => {
          this.handleRpcEvent(event.payload);
        });

        // 3. 启动计时器
        this.runStartTime = performance.now();
        if (this.metricsTimer) clearInterval(this.metricsTimer);
        this.metricsTimer = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(this.metricsTimer);
            return;
          }
          this.metrics.totalDurationMs = Math.round(performance.now() - this.runStartTime);
          const elapsedSec = this.metrics.totalDurationMs / 1000;
          if (elapsedSec > 0.1 && this.metrics.completionTokens > 0) {
            this.metrics.tps =
              Math.round((this.metrics.completionTokens / elapsedSec) * 10) / 10;
          }
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
          prompt: task.userPrompt,
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
  },
});
