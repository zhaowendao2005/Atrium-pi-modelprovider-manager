<template>
  <div class="flex h-full w-full overflow-hidden select-none">
    <!-- Left Column: Test History Center (Groups & Sessions Tree with Filter) -->
    <TestHistorySidebar />

    <!-- Right Column: Multi-Card Layout Workbench Content -->
    <div class="flex-1 h-full flex flex-col min-w-0 bg-background/50 overflow-hidden">
      <!-- Inner Header: Apple-style Minimalist Navbar with Layout Switcher SVG before Title -->
      <div class="px-5 py-2.5 border-b border-border/60 bg-card/40 backdrop-blur-md flex items-center justify-between gap-4 flex-shrink-0">
        <!-- Left: Layout Switcher SVG Button (No text label per requirement) + Title & Status -->
        <div class="flex items-center gap-2.5 min-w-0">
          <!-- Layout Switcher SVG Icon Dropdown Trigger -->
          <LayoutSwitcher />

          <div
            class="w-2 h-2 rounded-full flex-shrink-0"
            :class="[
              testingStore.runningSessionsCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-primary'
            ]"
          />

          <h2 class="text-sm font-bold text-foreground truncate max-w-md" :title="headerTitle">
            {{ headerTitle }}
          </h2>

          <Badge size="sm" variant="secondary" class="text-[10px] px-2 py-0.5 whitespace-nowrap flex-shrink-0">
            {{ headerCategory }}
          </Badge>

          <!-- Running sessions counter indicator -->
          <span
            v-if="testingStore.runningSessionsCount > 0"
            class="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 whitespace-nowrap"
          >
            {{ testingStore.runningSessionsCount }} 个 Agent 运行中
          </span>
        </div>

        <!-- Right: Toolbar Box (Apple style SVG action buttons) -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <!-- 按钮 1: 指标 ("点哪个的指标就显示谁的", 默认当前聚焦卡片指标) -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/70 text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-150 shadow-xs"
            title="查看当前聚焦卡片的微观请求时序、Git 节点图与双轨 TPS 指标"
            @click="openFocusedMetrics"
          >
            <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>指标</span>
            <span
              v-if="currentSlotRequestMetricsCount > 0"
              class="font-mono text-[10px] px-1 rounded-full bg-primary/10 text-primary font-bold"
            >
              {{ currentSlotRequestMetricsCount }}
            </span>
          </button>

          <!-- 按钮 2: 任务详情 (Details Sheet) -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/70 text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-150 shadow-xs"
            title="查看当前任务元数据、沙箱工作空间与产出清单"
            @click="drawerStore.openTestTaskDetails()"
          >
            <svg class="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>任务详情</span>
          </button>

          <!-- 按钮 3: 发起新测试 (Dedicated Fullscreen Launcher Wizard) -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all duration-150 shadow-xs active:scale-95"
            title="发起全新测试会话或批量评测矩阵"
            @click="drawerStore.openLauncherModal()"
          >
            <svg class="w-3.5 h-3.5 fill-none stroke-current" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>发起测试</span>
          </button>
        </div>
      </div>

      <!-- Main Content Area: MultiCardContainer supporting 5 Layouts -->
      <MultiCardContainer />
    </div>

    <!-- Task Details Sheet -->
    <TaskDetailsSheet />

    <!-- Task Metrics Sheet (Shows metrics for the focused or chosen card) -->
    <TaskMetricsSheet />

    <!-- Task Materials Sheet -->
    <TaskMaterialsSheet />

    <!-- Dedicated Fullscreen Focused Session Modal (Maximize button on card) -->
    <FocusedSessionModal />

    <!-- Dedicated Fullscreen Test Launcher Modal (Wizard for task, matrix, concurrency & layout) -->
    <TestLauncherModal />

    <!-- Legacy Batch Test Modal (preserved) -->
    <BatchTestModal />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useTestingStore } from "../../stores/testing.js";
import { useProviderStore } from "../../stores/provider.js";
import { useDrawerStore } from "../../stores/windows/drawer.js";
import LayoutSwitcher from "./components/LayoutSwitcher.vue";
import TestHistorySidebar from "./components/TestHistorySidebar.vue";
import MultiCardContainer from "./components/MultiCardContainer.vue";
import FocusedSessionModal from "./components/FocusedSessionModal.vue";
import TestLauncherModal from "./components/TestLauncherModal.vue";
import TaskDetailsSheet from "./components/TaskDetailsSheet.vue";
import TaskMetricsSheet from "./components/TaskMetricsSheet.vue";
import TaskMaterialsSheet from "./components/TaskMaterialsSheet.vue";
import BatchTestModal from "./components/BatchTestModal.vue";
import Badge from "../../components/ui/Badge.vue";

const testingStore = useTestingStore();
const providerStore = useProviderStore();
const drawerStore = useDrawerStore();

const headerTitle = computed(() => {
  if (testingStore.activeGroup) {
    return testingStore.activeGroup.name;
  }
  if (testingStore.activeSlotSession) {
    const s = testingStore.activeSlotSession;
    return `${s.modelName || s.modelId} (${s.providerName || s.providerId})`;
  }
  return testingStore.activeTask.name;
});

const headerCategory = computed(() => {
  if (testingStore.activeSlotSession) {
    const task = testingStore.tasks.find((t) => t.id === testingStore.activeSlotSession?.taskId);
    return task?.category || testingStore.activeTask.category;
  }
  return testingStore.activeTask.category;
});

const currentSlotRequestMetricsCount = computed(() => {
  return testingStore.activeSlotSession?.metrics?.requestMetrics?.length || 0;
});

function openFocusedMetrics() {
  const sid = testingStore.activeSlotSession?.id;
  drawerStore.openTestMetrics(sid);
}

onMounted(async () => {
  await testingStore.loadTasks();

  if (testingStore.messages.length === 0) {
    testingStore.initTaskMessages();
  }

  // 默认填充首个 provider 和 model
  if (!testingStore.selectedProviderId && providerStore.activeProvider) {
    testingStore.selectedProviderId = providerStore.activeProvider.id;
    if (providerStore.activeProvider.models?.[0]) {
      testingStore.selectedModelId = providerStore.activeProvider.models[0].id;
    }
  }
});
</script>
