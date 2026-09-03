<template>
  <div class="border-t border-border/70 bg-card/70 backdrop-blur-xl px-6 py-3 flex flex-col gap-2.5 select-none z-10 flex-shrink-0">
    <!-- Row 0: Target Model Selection Matrix (Moved from header for clean minimalism) -->
    <div class="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-border/50 text-xs">
      <div class="flex items-center gap-2.5 flex-wrap min-w-0">
        <span class="text-[11px] font-semibold text-foreground/80 whitespace-nowrap flex-shrink-0 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          测试目标:
        </span>

        <!-- Provider Dropdown -->
        <div class="w-36 flex-shrink-0">
          <Select
            v-model="selectedProviderId"
            :options="providerOptions"
            placeholder="选择提供商..."
            size="sm"
            :searchable="true"
          />
        </div>

        <!-- Model Dropdown -->
        <div class="w-48 flex-shrink-0">
          <Select
            v-model="selectedModelId"
            :options="modelOptions"
            placeholder="选择模型..."
            size="sm"
            :searchable="true"
          />
        </div>

        <!-- Capability Badges -->
        <div v-if="activeModelDetails" class="flex items-center gap-1.5 flex-shrink-0">
          <span
            v-if="activeModelDetails.reasoning"
            class="text-[10px] px-2 py-0.5 rounded-md font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap font-medium"
            title="支持深度思考推理"
          >
            Reasoning
          </span>
          <span
            v-if="activeModelDetails.input?.includes('image')"
            class="text-[10px] px-2 py-0.5 rounded-md font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 whitespace-nowrap font-medium"
            title="支持图像多模态输入"
          >
            Vision
          </span>
          <span
            v-if="activeModelDetails.contextWindow"
            class="text-[10px] px-2 py-0.5 rounded-md font-mono bg-slate-200/70 dark:bg-slate-800 text-muted-foreground whitespace-nowrap"
            title="上下文窗口"
          >
            {{ Math.round(activeModelDetails.contextWindow / 1024) }}k
          </span>
        </div>
      </div>
    </div>

    <!-- Row 1: State Machine Indicator & Realtime Metrics Panel -->
    <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
      <!-- Left: State Machine Status Badge -->
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground font-medium text-[11px]">Agent 状态:</span>
        <div
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all"
          :class="stateBadgeClass"
        >
          <!-- State Icon -->
          <svg
            v-if="testingStore.isRunning"
            class="animate-spin w-3 h-3 text-current flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span
            v-else
            class="w-2 h-2 rounded-full flex-shrink-0"
            :class="[
              testingStore.executionState === 'completed'
                ? 'bg-emerald-500'
                : testingStore.executionState === 'stopped'
                ? 'bg-amber-500'
                : testingStore.executionState === 'error'
                ? 'bg-destructive'
                : 'bg-slate-400',
            ]"
          />
          <span>{{ stateLabel }}</span>
        </div>
      </div>

      <!-- Right: Real-time Performance Capsules -->
      <div class="flex items-center gap-2 font-mono text-[11px] overflow-x-auto no-scrollbar">
        <!-- TTFT (First token latency) -->
        <div class="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/50 text-foreground/80 flex items-center gap-1.5 whitespace-nowrap">
          <span class="text-muted-foreground font-sans text-[10px]">首字延迟</span>
          <span class="font-bold text-foreground">
            {{ testingStore.metrics.firstTokenMs ? `${testingStore.metrics.firstTokenMs}ms` : '--' }}
          </span>
        </div>

        <!-- TPS (Tokens per second) -->
        <div class="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/50 text-foreground/80 flex items-center gap-1.5 whitespace-nowrap">
          <span class="text-muted-foreground font-sans text-[10px]">速率</span>
          <span class="font-bold text-foreground">
            {{ testingStore.metrics.tps ? `${testingStore.metrics.tps} tps` : '--' }}
          </span>
        </div>

        <!-- Tokens -->
        <div class="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/50 text-foreground/80 flex items-center gap-1.5 whitespace-nowrap">
          <span class="text-muted-foreground font-sans text-[10px]">Tokens</span>
          <span class="font-bold text-foreground">{{ testingStore.metrics.totalTokens }}</span>
        </div>

        <!-- Total Duration -->
        <div class="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/50 text-foreground/80 flex items-center gap-1.5 whitespace-nowrap">
          <span class="text-muted-foreground font-sans text-[10px]">耗时</span>
          <span class="font-bold text-foreground">
            {{ (testingStore.metrics.totalDurationMs / 1000).toFixed(1) }}s
          </span>
        </div>

        <!-- Tool Calls -->
        <div
          v-if="testingStore.metrics.toolCallsCount > 0"
          class="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 whitespace-nowrap"
        >
          <span class="font-sans text-[10px]">工具调用</span>
          <span class="font-bold">{{ testingStore.metrics.toolCallsCount }}</span>
        </div>
      </div>
    </div>

    <!-- Row 2: Operation Matrix (Execution / Stop / Reset / Open Workspace) -->
    <div class="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
      <!-- Left: Primary Execution & Control Buttons -->
      <div class="flex items-center gap-2">
        <!-- Start Test Button (if not running) -->
        <Button
          v-if="!testingStore.isRunning"
          variant="primary"
          size="md"
          class="h-9 px-5 gap-2 font-semibold shadow-md shadow-primary/20 whitespace-nowrap"
          title="启动 Pi Coding Agent 真实执行测试"
          @click="testingStore.startTest"
        >
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>执行测试</span>
        </Button>

        <!-- Stop / Abort Button (if running) -->
        <Button
          v-else
          variant="destructive"
          size="md"
          class="h-9 px-5 gap-2 font-semibold shadow-md shadow-destructive/20 animate-pulse whitespace-nowrap"
          title="中断正在执行的 Pi Agent 进程"
          @click="testingStore.stopTest"
        >
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          <span>停止执行</span>
        </Button>

        <!-- Reset Button -->
        <Button
          variant="outline"
          size="md"
          class="h-9 px-3 gap-1.5 text-muted-foreground hover:text-foreground whitespace-nowrap"
          title="重置当前任务与测试日志"
          @click="testingStore.resetCurrentTask"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>重置</span>
        </Button>
      </div>

      <!-- Right: Open Workspace Folder Quick Action -->
      <div class="flex items-center gap-2">
        <Button
          v-if="testingStore.currentWorkspaceDir"
          variant="secondary"
          size="sm"
          class="h-8 px-3 gap-1.5 text-xs text-foreground/80 whitespace-nowrap"
          title="在 Windows 资源管理器中打开当前测试工作空间"
          @click="testingStore.openCurrentWorkspace"
        >
          <svg class="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span>打开工作空间</span>
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTestingStore } from "../../../stores/testing.js";
import { useProviderStore } from "../../../stores/provider.js";
import Button from "../../../components/ui/Button.vue";
import Select, { type SelectOption } from "../../../components/ui/Select.vue";

const testingStore = useTestingStore();
const providerStore = useProviderStore();

// 提供商下拉选项
const providerOptions = computed<SelectOption[]>(() => {
  return providerStore.providers.map((p) => ({
    label: p.name || p.id,
    value: p.id,
    description: `${p.models?.length || 0} 个模型`,
  }));
});

// 当前选中的 Provider ID
const selectedProviderId = computed({
  get: () => testingStore.selectedProviderId || providerStore.activeProvider?.id || "",
  set: (val: string) => {
    testingStore.selectedProviderId = val;
    const p = providerStore.providers.find((item) => item.id === val);
    if (p && p.models && p.models.length > 0) {
      testingStore.selectedModelId = p.models[0].id;
    } else {
      testingStore.selectedModelId = "";
    }
  },
});

// 当前 Provider 下可用的模型列表
const currentProvider = computed(() => {
  const pId = selectedProviderId.value;
  return providerStore.providers.find((p) => p.id === pId) || providerStore.activeProvider;
});

// 模型下拉选项
const modelOptions = computed<SelectOption[]>(() => {
  const p = currentProvider.value;
  if (!p || !p.models) return [];
  return p.models.map((m) => ({
    label: m.name || m.id,
    value: m.id,
    description: m.family || "通用模型",
  }));
});

// 当前选中的 Model ID
const selectedModelId = computed({
  get: () => {
    if (testingStore.selectedModelId) return testingStore.selectedModelId;
    const p = currentProvider.value;
    return p?.models?.[0]?.id || "";
  },
  set: (val: string) => {
    testingStore.selectedModelId = val;
  },
});

// 当前选中模型的详细规格
const activeModelDetails = computed(() => {
  const p = currentProvider.value;
  if (!p || !p.models) return null;
  const mId = selectedModelId.value;
  return p.models.find((m) => m.id === mId) || p.models[0] || null;
});

const stateLabel = computed(() => {
  switch (testingStore.executionState) {
    case "idle":
      return "就绪 (IDLE)";
    case "preparing_workspace":
      return "初始化工作空间 (PREPARING)";
    case "running_agent":
      return "Agent 运行中 (RUNNING)";
    case "streaming_reasoning":
      return "深度思考中 (REASONING)";
    case "calling_tool":
      return "工具调用处理 (TOOL_CALL)";
    case "streaming_text":
      return "回答流式传输 (STREAMING)";
    case "completed":
      return "完成 (COMPLETED)";
    case "stopped":
      return "已停止 (STOPPED)";
    case "error":
      return "异常 (ERROR)";
    default:
      return testingStore.executionState;
  }
});

const stateBadgeClass = computed(() => {
  switch (testingStore.executionState) {
    case "idle":
      return "bg-slate-200/60 dark:bg-slate-800/80 text-muted-foreground";
    case "preparing_workspace":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20";
    case "running_agent":
    case "streaming_text":
      return "bg-primary/15 text-primary border border-primary/20";
    case "streaming_reasoning":
      return "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20";
    case "calling_tool":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    case "completed":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    case "stopped":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    case "error":
      return "bg-destructive/15 text-destructive border border-destructive/20";
    default:
      return "bg-muted text-muted-foreground";
  }
});
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
