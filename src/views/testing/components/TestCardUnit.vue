<template>
  <div
    class="flex flex-col h-full rounded-2xl border bg-card/80 backdrop-blur-xl overflow-hidden transition-all duration-200 shadow-sm relative"
    :class="[
      isFocused
        ? 'border-primary/60 ring-2 ring-primary/20 shadow-md'
        : 'border-border/60 hover:border-border/90'
    ]"
    @click="focusCard"
  >
    <!-- Card Header: Focus pill, Model Title, Status, Action Icons (Metrics, Maximize, Workspace) -->
    <div class="px-4 py-2.5 border-b border-border/50 bg-muted/20 flex items-center justify-between gap-2 flex-shrink-0">
      <!-- Left: Focus indicator dot & Model Title -->
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span
          class="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
          :class="[
            isRunning
              ? 'bg-emerald-500 animate-pulse'
              : isFocused
              ? 'bg-primary'
              : 'bg-muted-foreground/40'
          ]"
        />

        <div class="min-w-0 flex-1 flex items-center gap-1.5 truncate">
          <span
            class="text-xs font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
            :title="session.modelName || session.modelId"
          >
            {{ session.modelName || session.modelId }}
          </span>

          <span
            class="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono truncate max-w-[120px]"
            :title="session.providerName || session.providerId"
          >
            {{ session.providerName || session.providerId }}
          </span>
        </div>
      </div>

      <!-- Right: Actions Toolbar (Metrics Button, Maximize Button, Folder) -->
      <div class="flex items-center gap-1 flex-shrink-0">
        <!-- 1. 指标按钮 ("点谁的指标就显示谁的") -->
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 bg-card hover:bg-muted/70 text-muted-foreground hover:text-foreground text-[11px] font-medium transition-all"
          :class="{ 'border-primary/40 text-primary bg-primary/10': isMetricsActiveForThisCard }"
          title="查看该卡片的微观请求时序与双轨 TPS 指标"
          @click.stop="openCardMetrics"
        >
          <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="hidden sm:inline">指标</span>
          <span
            v-if="session.metrics?.requestMetrics?.length"
            class="text-[10px] font-mono px-1 rounded-full bg-primary/15 text-primary font-bold"
          >
            {{ session.metrics.requestMetrics.length }}
          </span>
        </button>

        <!-- 2. 全屏放大按钮 (打开聚焦全屏模态框) -->
        <button
          type="button"
          class="p-1 rounded-lg border border-border/60 bg-card hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all"
          title="全屏放大查看该会话"
          @click.stop="drawerStore.openFocusedModal(session.id)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        <!-- 3. 打开工作空间文件夹 -->
        <button
          v-if="session.workspaceDir"
          type="button"
          class="p-1 rounded-lg border border-border/60 bg-card hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all"
          title="在 Windows 资源管理器中打开沙箱目录"
          @click.stop="openWorkspace"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>

        <!-- 4. 移除/解绑卡片 (仅移出工作台，不删除历史记录) -->
        <button
          type="button"
          class="p-1 rounded-lg border border-border/60 bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          title="从工作台中移出此卡片 (不删除历史记录)"
          @click.stop="closeCard"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Card Body: Real-time Message Stream Area -->
    <div class="flex-1 min-h-0 overflow-hidden relative bg-background/30">
      <VirtualMessageList :messages="session.messages || []" />
    </div>

    <!-- Card Footer & Console: Dual TPS, Duration, and Operation Controls -->
    <div class="p-3 border-t border-border/50 bg-card/90 backdrop-blur-md flex flex-col gap-2 flex-shrink-0">
      <!-- Row 1: Micro Metrics Capsules -->
      <div class="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-[11px] font-mono">
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <!-- 含首字 TPS (端到端) -->
          <div
            class="px-2 py-0.5 rounded-md bg-muted/60 border border-border/50 text-foreground/80 flex items-center gap-1 whitespace-nowrap"
            title="端到端平均响应速率 (含首字等待时间)"
          >
            <span class="text-muted-foreground font-sans text-[10px]">含首字</span>
            <span class="font-bold text-foreground">
              {{ session.metrics?.tpsWithTtft ? `${session.metrics.tpsWithTtft} tps` : "--" }}
            </span>
          </div>

          <!-- 不含首字 TPS (纯解码) -->
          <div
            class="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary flex items-center gap-1 whitespace-nowrap"
            title="纯 Token 解码生成速率 (扣除首字延迟)"
          >
            <span class="text-primary/70 font-sans text-[10px]">不含首字</span>
            <span class="font-bold">
              {{ session.metrics?.tpsWithoutTtft ? `${session.metrics.tpsWithoutTtft} tps` : "--" }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-shrink-0 text-muted-foreground text-[10px]">
          <span v-if="session.metrics?.totalDurationMs">
            {{ (session.metrics.totalDurationMs / 1000).toFixed(1) }}s
          </span>
          <span v-if="session.metrics?.toolCallsCount">
            · {{ session.metrics.toolCallsCount }} 工具
          </span>
        </div>
      </div>

      <!-- Row 2: Operation Bar (Start, Stop, Continue with Expandable Input, Reset) -->
      <div class="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
        <!-- Left: Control Actions -->
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <!-- Start Test Button (when idle) -->
          <button
            v-if="session.status === 'idle'"
            type="button"
            class="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
            title="启动该卡片的 Pi Agent RPC 测试"
            @click.stop="startTest"
          >
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>执行测试</span>
          </button>

          <!-- Stop / Abort Button (when running) -->
          <button
            v-else-if="isRunning"
            type="button"
            class="px-3 py-1.5 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold shadow-xs flex items-center gap-1.5 animate-pulse transition-all active:scale-95"
            title="中断当前卡片正在运行的 Agent 进程"
            @click.stop="stopTest"
          >
            <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span>停止执行</span>
          </button>

          <!-- Continue Testing Button Group (when completed/stopped/failed) -->
          <template v-else>
            <!-- Quick Continue Default Button -->
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
              title="采用默认指令继续后续测试任务与验证"
              @click.stop="quickContinue"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span>继续测试</span>
            </button>

            <!-- Toggle Custom Prompt Input -->
            <button
              type="button"
              class="p-1.5 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-all"
              :class="{ 'border-primary/40 text-primary bg-primary/10': isPromptInputVisible }"
              title="展开自定义继续提示词输入框"
              @click.stop="isPromptInputVisible = !isPromptInputVisible"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </template>

          <!-- Reset Button -->
          <button
            type="button"
            class="p-1.5 rounded-xl border border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-all"
            title="重置当前卡片"
            @click.stop="resetSession"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <!-- Right: Status Badge -->
        <div class="text-[10px] font-mono px-2 py-0.5 rounded-md border flex-shrink-0 whitespace-nowrap" :class="statusBadgeClass">
          {{ statusLabel }}
        </div>
      </div>

      <!-- Expandable Prompt Input for Continue -->
      <div v-if="isPromptInputVisible && !isRunning" class="pt-2 flex items-center gap-1.5 animate-in fade-in duration-150">
        <input
          v-model="continuePromptInput"
          type="text"
          placeholder="输入给 Agent 的后续指令..."
          class="flex-1 px-3 py-1.5 text-xs bg-muted/40 border border-border/60 rounded-xl placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground"
          @keydown.enter.prevent="sendCustomContinue"
        />
        <button
          type="button"
          class="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-all shadow-xs"
          @click="sendCustomContinue"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useTestingStore } from "../../../stores/testing.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import type { TestSession } from "../../../types/testing.js";
import VirtualMessageList from "./VirtualMessageList.vue";

const props = defineProps<{
  session: TestSession;
  slotIndex: number;
}>();

const testingStore = useTestingStore();
const drawerStore = useDrawerStore();

const isPromptInputVisible = ref(false);
const continuePromptInput = ref("请继续完成后续任务与验证并报告结果");

const isFocused = computed(() => testingStore.focusedSlotIndex === props.slotIndex);

const isRunning = computed(() => props.session.status === "running" || props.session.status === "preparing");

const isMetricsActiveForThisCard = computed(() => {
  return drawerStore.isTestMetricsOpen && drawerStore.activeMetricsSessionId === props.session.id;
});

const statusLabel = computed(() => {
  switch (props.session.status) {
    case "preparing": return "准备沙箱中...";
    case "running": return "Agent 运行中";
    case "completed": return "测试完成";
    case "failed": return "执行异常";
    case "stopped": return "已手动中止";
    default: return "待测试";
  }
});

const statusBadgeClass = computed(() => {
  switch (props.session.status) {
    case "preparing":
    case "running":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "completed":
      return "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400";
    case "failed":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "stopped":
      return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    default:
      return "border-border/60 bg-muted/30 text-muted-foreground";
  }
});

function focusCard() {
  testingStore.setFocusedSlot(props.slotIndex);
}

function openCardMetrics() {
  focusCard();
  drawerStore.openTestMetrics(props.session.id);
}

function startTest() {
  focusCard();
  testingStore.startSession(props.session.id);
}

function stopTest() {
  testingStore.stopSession(props.session.id);
}

function quickContinue() {
  focusCard();
  testingStore.continueSession(props.session.id, "请继续完成后续任务与验证并报告结果");
}

function sendCustomContinue() {
  if (!continuePromptInput.value.trim()) return;
  focusCard();
  testingStore.continueSession(props.session.id, continuePromptInput.value);
  isPromptInputVisible.value = false;
}

function resetSession() {
  props.session.messages = [];
  props.session.metrics = {
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
  props.session.status = "idle";
  props.session.error = undefined;
  testingStore.saveSessionToDb(props.session);
}

async function openWorkspace() {
  if (!props.session.workspaceDir) return;
  try {
    await invoke("open_workspace_in_explorer", {
      workspaceDir: props.session.workspaceDir,
    });
  } catch (err) {
    console.error("打开工作空间失败", err);
  }
}

function closeCard() {
  if (isRunning.value) {
    testingStore.stopSession(props.session.id);
  }
  testingStore.removeSlot(props.slotIndex);
}
</script>
