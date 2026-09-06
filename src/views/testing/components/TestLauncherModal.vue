<template>
  <div
    v-if="drawerStore.isLauncherModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 backdrop-blur-md select-none animate-in fade-in duration-200"
    @click.self="drawerStore.closeLauncherModal()"
  >
    <!-- Modal Dialog Window (Dedicated Fullscreen Launcher Wizard) -->
    <div
      class="w-full h-full max-w-5xl max-h-[92vh] rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-4 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-bold text-foreground">发起 Agent 评测测试</h2>
            <p class="text-xs text-muted-foreground">选择评测任务场景、勾选测试模型矩阵并自定义并发与布局</p>
          </div>
        </div>

        <button
          type="button"
          class="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          @click="drawerStore.closeLauncherModal()"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Body (Two Column Layout: Left Tasks & Config, Right Model Matrix) -->
      <div class="flex-1 min-h-0 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 apple-scrollbar">
        <!-- Left Column: Task Selection & Concurrency Settings (5 cols) -->
        <div class="md:col-span-5 flex flex-col gap-5">
          <!-- 1. Task Scenario Selection -->
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-primary" />
              第一步：选择测试任务场景
            </label>

            <div class="space-y-2">
              <div
                v-for="task in testingStore.tasks"
                :key="task.id"
                class="p-3 rounded-2xl border transition-all cursor-pointer text-left"
                :class="[
                  selectedTaskId === task.id
                    ? 'border-primary bg-primary/10 shadow-xs'
                    : 'border-border/60 bg-muted/20 hover:bg-muted/50'
                ]"
                @click="onSelectTask(task.id)"
              >
                <div class="flex items-center justify-between gap-2 mb-1">
                  <span class="text-xs font-bold text-foreground truncate">{{ task.name }}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    {{ task.category }}
                  </span>
                </div>
                <p class="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {{ task.description }}
                </p>
              </div>
            </div>
          </div>

          <!-- 2. Concurrency Limit Control -->
          <div class="p-4 rounded-2xl border border-border/60 bg-muted/20 flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-foreground flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                并发执行限制 (Concurrency)
              </label>
              <span class="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded-lg bg-primary/10">
                {{ concurrencyLimit }} 线程并发
              </span>
            </div>

            <p class="text-[11px] text-muted-foreground leading-relaxed">
              控制同时启动运行的 Pi Agent 独立子进程数。超出并发上限的模型将自动排队。
            </p>

            <div class="flex items-center gap-3 pt-1">
              <input
                v-model.number="concurrencyLimit"
                type="range"
                min="1"
                max="16"
                step="1"
                class="flex-1 accent-primary cursor-pointer"
              />
              <span class="text-xs font-mono text-muted-foreground w-8 text-right font-semibold">
                {{ concurrencyLimit }}
              </span>
            </div>
          </div>

          <!-- 3. Layout Preference (Auto recommendation + user override) -->
          <div class="p-4 rounded-2xl border border-border/60 bg-muted/20 flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-foreground">工作台视图布局偏好</label>
              <span class="text-[10px] text-muted-foreground">
                已自动匹配: {{ formatLayoutName(effectiveLayout) }}
              </span>
            </div>

            <div class="grid grid-cols-5 gap-1.5">
              <button
                v-for="l in layoutOptions"
                :key="l.id"
                type="button"
                class="py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all"
                :class="[
                  (userChosenLayout || effectiveLayout) === l.id
                    ? 'border-primary bg-primary/15 text-primary font-bold shadow-xs'
                    : 'border-border/60 bg-card hover:bg-muted text-muted-foreground'
                ]"
                :title="l.desc"
                @click="userChosenLayout = l.id"
              >
                <component :is="l.icon" class="w-4 h-4" />
                <span class="text-[10px] scale-90">{{ l.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Right Column: Target Model Matrix & Prompt (7 cols) -->
        <div class="md:col-span-7 flex flex-col gap-5">
          <!-- 4. Target Models Matrix -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-primary" />
                第二步：选择测试模型矩阵
              </label>

              <div class="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  class="text-primary hover:underline font-medium text-[11px]"
                  @click="selectAllModels"
                >
                  全选全部
                </button>
                <span class="text-muted-foreground/50">|</span>
                <button
                  type="button"
                  class="text-muted-foreground hover:text-foreground text-[11px]"
                  @click="deselectAllModels"
                >
                  清空已选
                </button>
              </div>
            </div>

            <!-- Provider/Model Groups Accordion List -->
            <div class="space-y-3 max-h-[360px] overflow-y-auto pr-1 apple-scrollbar">
              <div
                v-for="provider in providerStore.providers"
                :key="provider.id"
                class="rounded-2xl border border-border/60 bg-muted/10 p-3 flex flex-col gap-2"
              >
                <!-- Provider Header -->
                <div class="flex items-center justify-between pb-1.5 border-b border-border/40">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-muted-foreground/60" />
                    <span class="text-xs font-bold text-foreground">{{ provider.name || provider.id }}</span>
                    <span class="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                      {{ provider.models?.length || 0 }} 模型
                    </span>
                  </div>

                  <button
                    type="button"
                    class="text-[10px] text-primary hover:underline"
                    @click="selectProviderAll(provider)"
                  >
                    全选此提供商
                  </button>
                </div>

                <!-- Models Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <label
                    v-for="model in provider.models || []"
                    :key="`${provider.id}::${model.id}`"
                    class="flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer"
                    :class="[
                      isModelSelected(provider.id, model.id)
                        ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                        : 'border-border/40 bg-card/60 hover:bg-muted/50 text-foreground'
                    ]"
                  >
                    <input
                      type="checkbox"
                      :checked="isModelSelected(provider.id, model.id)"
                      class="rounded border-border text-primary focus:ring-primary/30 w-3.5 h-3.5 accent-primary cursor-pointer"
                      @change="toggleModelSelection(provider, model)"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="text-xs truncate" :title="model.name || model.id">
                        {{ model.name || model.id }}
                      </div>
                      <div class="text-[9px] text-muted-foreground flex items-center gap-1 font-mono">
                        <span v-if="model.reasoning" class="text-indigo-500 font-semibold">Reasoning</span>
                        <span v-if="model.contextWindow">{{ Math.round(model.contextWindow / 1024) }}k</span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Prompt Preview & Override -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-foreground">自定义任务指令 (Prompt)</label>
              <button
                type="button"
                class="text-[10px] text-muted-foreground hover:text-primary"
                @click="resetPromptToTaskDefault"
              >
                恢复任务默认提示词
              </button>
            </div>
            <textarea
              v-model="customPrompt"
              rows="3"
              class="w-full p-3 text-xs bg-muted/40 border border-border/60 rounded-2xl placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground font-mono leading-relaxed"
              placeholder="在此微调发送给 Agent 的测试指令..."
            />
          </div>
        </div>
      </div>

      <!-- Modal Bottom Bar: Summary & Primary Launch Button -->
      <div class="px-6 py-4 border-t border-border/60 bg-card/90 backdrop-blur-xl flex items-center justify-between gap-4 flex-shrink-0">
        <!-- Summary Stats -->
        <div class="flex items-center gap-3 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5">
            已勾选 <strong class="text-foreground font-mono font-bold">{{ selectedTargets.length }}</strong> 个模型
          </span>
          <span>·</span>
          <span>布局: <strong class="text-foreground">{{ formatLayoutName(effectiveLayout) }}</strong></span>
          <span>·</span>
          <span>并发: <strong class="text-foreground">{{ concurrencyLimit }} 进程</strong></span>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-border/70 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
            @click="drawerStore.closeLauncherModal()"
          >
            取消
          </button>

          <button
            type="button"
            class="px-6 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-md shadow-primary/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="selectedTargets.length === 0"
            @click="launchTest"
          >
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>立即发起测试 ({{ selectedTargets.length }})</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from "vue";
import { useTestingStore } from "../../../stores/testing.js";
import { useProviderStore } from "../../../stores/provider.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import type {
  BatchModelTarget,
  WorkbenchLayoutMode,
} from "../../../types/testing.js";
import type { ProviderSchema, ModelSchema } from "../../../types/index.js";

const testingStore = useTestingStore();
const providerStore = useProviderStore();
const drawerStore = useDrawerStore();

const selectedTaskId = ref(testingStore.activeTaskId || testingStore.tasks[0]?.id || "01_speed_and_stream");
const concurrencyLimit = ref(4);
const userChosenLayout = ref<WorkbenchLayoutMode | null>(null);
const customPrompt = ref("");
const selectedTargets = ref<BatchModelTarget[]>([]);

// Layout SVG Icons
const SingleIcon = () =>
  h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, [
    h("rect", { x: "4", y: "4", width: "16", height: "16", rx: "3" }),
  ]);

const DualIcon = () =>
  h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, [
    h("rect", { x: "3", y: "4", width: "8", height: "16", rx: "2" }),
    h("rect", { x: "13", y: "4", width: "8", height: "16", rx: "2" }),
  ]);

const QuadIcon = () =>
  h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, [
    h("rect", { x: "3", y: "3", width: "8", height: "8", rx: "2" }),
    h("rect", { x: "13", y: "3", width: "8", height: "8", rx: "2" }),
    h("rect", { x: "3", y: "13", width: "8", height: "8", rx: "2" }),
    h("rect", { x: "13", y: "13", width: "8", height: "8", rx: "2" }),
  ]);

const MultiColIcon = () =>
  h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, [
    h("rect", { x: "2", y: "4", width: "5.5", height: "16", rx: "1.5" }),
    h("rect", { x: "9.25", y: "4", width: "5.5", height: "16", rx: "1.5" }),
    h("rect", { x: "16.5", y: "4", width: "5.5", height: "16", rx: "1.5" }),
  ]);

const TwoRowMultiColIcon = () =>
  h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, [
    h("rect", { x: "2", y: "3", width: "5.5", height: "7.5", rx: "1.5" }),
    h("rect", { x: "2", y: "13.5", width: "5.5", height: "7.5", rx: "1.5" }),
    h("rect", { x: "9.25", y: "3", width: "5.5", height: "7.5", rx: "1.5" }),
    h("rect", { x: "9.25", y: "13.5", width: "5.5", height: "7.5", rx: "1.5" }),
    h("rect", { x: "16.5", y: "3", width: "5.5", height: "7.5", rx: "1.5" }),
    h("rect", { x: "16.5", y: "13.5", width: "5.5", height: "7.5", rx: "1.5" }),
  ]);

const layoutOptions = [
  { id: "single" as WorkbenchLayoutMode, label: "单卡片", desc: "1×1 专注独占", icon: SingleIcon },
  { id: "dual" as WorkbenchLayoutMode, label: "双卡片", desc: "1×2 两模型实时比对", icon: DualIcon },
  { id: "quad" as WorkbenchLayoutMode, label: "四宫格", desc: "2×2 四模型矩阵", icon: QuadIcon },
  { id: "multi-col" as WorkbenchLayoutMode, label: "多列横排", desc: "单行自适应固定宽无限横排", icon: MultiColIcon },
  { id: "two-row-multi-col" as WorkbenchLayoutMode, label: "两行多列", desc: "双行多列瀑布平铺", icon: TwoRowMultiColIcon },
];

// Initialize default targets when modal opens
watch(
  () => drawerStore.isLauncherModalOpen,
  (open) => {
    if (open) {
      userChosenLayout.value = null;
      concurrencyLimit.value = 4;
      const activeTask = testingStore.tasks.find((t) => t.id === selectedTaskId.value) || testingStore.tasks[0];
      if (activeTask) {
        customPrompt.value = activeTask.userPrompt;
      }
      // 默认勾选当前活跃 provider 的首个模型，或第一个可用模型
      if (selectedTargets.value.length === 0) {
        const provider = providerStore.activeProvider || providerStore.providers[0];
        if (provider?.models?.[0]) {
          selectedTargets.value = [
            {
              providerId: provider.id,
              modelId: provider.models[0].id,
              providerName: provider.name || provider.id,
              modelName: provider.models[0].name || provider.models[0].id,
            },
          ];
        }
      }
    }
  },
  { immediate: true }
);

function onSelectTask(taskId: string) {
  selectedTaskId.value = taskId;
  const task = testingStore.tasks.find((t) => t.id === taskId);
  if (task) {
    customPrompt.value = task.userPrompt;
  }
}

function resetPromptToTaskDefault() {
  const task = testingStore.tasks.find((t) => t.id === selectedTaskId.value);
  if (task) {
    customPrompt.value = task.userPrompt;
  }
}

const effectiveLayout = computed<WorkbenchLayoutMode>(() => {
  if (userChosenLayout.value) return userChosenLayout.value;
  const count = selectedTargets.value.length;
  if (count <= 1) return "single";
  if (count === 2) return "dual";
  if (count <= 4) return "quad";
  if (count <= 8) return "multi-col";
  return "two-row-multi-col";
});

function isModelSelected(providerId: string, modelId: string): boolean {
  return selectedTargets.value.some((t) => t.providerId === providerId && t.modelId === modelId);
}

function toggleModelSelection(provider: ProviderSchema, model: ModelSchema) {
  const idx = selectedTargets.value.findIndex(
    (t) => t.providerId === provider.id && t.modelId === model.id
  );
  if (idx !== -1) {
    selectedTargets.value.splice(idx, 1);
  } else {
    selectedTargets.value.push({
      providerId: provider.id,
      modelId: model.id,
      providerName: provider.name || provider.id,
      modelName: model.name || model.id,
    });
  }
}

function selectProviderAll(provider: ProviderSchema) {
  for (const model of provider.models || []) {
    if (!isModelSelected(provider.id, model.id)) {
      selectedTargets.value.push({
        providerId: provider.id,
        modelId: model.id,
        providerName: provider.name || provider.id,
        modelName: model.name || model.id,
      });
    }
  }
}

function selectAllModels() {
  const all: BatchModelTarget[] = [];
  for (const p of providerStore.providers) {
    for (const m of p.models || []) {
      all.push({
        providerId: p.id,
        modelId: m.id,
        providerName: p.name || p.id,
        modelName: m.name || m.id,
      });
    }
  }
  selectedTargets.value = all;
}

function deselectAllModels() {
  selectedTargets.value = [];
}

function formatLayoutName(mode: string): string {
  switch (mode) {
    case "single": return "单卡片";
    case "dual": return "双卡片横排";
    case "quad": return "四宫格";
    case "multi-col": return "多列横向";
    case "two-row-multi-col": return "两行多列";
    default: return mode;
  }
}

async function launchTest() {
  if (selectedTargets.value.length === 0) return;

  const config = {
    taskId: selectedTaskId.value,
    targets: [...selectedTargets.value],
    layoutMode: effectiveLayout.value,
    concurrency: concurrencyLimit.value,
    customPrompt: customPrompt.value,
  };

  drawerStore.closeLauncherModal();
  await testingStore.batchLaunch(config);
}
</script>
