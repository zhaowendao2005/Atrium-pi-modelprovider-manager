<template>
  <div class="w-72 h-full flex flex-col border-r border-border bg-card/40 backdrop-blur-md flex-shrink-0 select-none">
    <!-- Top Header: Title & Action -->
    <div class="p-3.5 border-b border-border/60 flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-bold text-foreground tracking-tight">测试任务</h2>
          <span class="text-[11px] px-1.5 py-0.5 rounded-md font-semibold bg-muted text-muted-foreground">
            {{ testingStore.filteredTasks.length }}
          </span>
        </div>

        <!-- Add Custom Task Button -->
        <button
          type="button"
          title="创建自定义测试任务"
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          @click="$emit('open-create-modal')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative">
        <svg
          class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="testingStore.searchQuery"
          type="text"
          placeholder="搜索任务或用例..."
          class="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
        />
        <button
          v-if="testingStore.searchQuery"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
          @click="testingStore.searchQuery = ''"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Category Filter Pills -->
      <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors"
          :class="[
            testingStore.selectedCategory === cat.id
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
          ]"
          @click="testingStore.selectedCategory = cat.id"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- Task List (with AppleScrollArea) -->
    <AppleScrollArea class="flex-1 p-2">
      <div v-if="testingStore.filteredTasks.length === 0" class="h-32 flex flex-col items-center justify-center text-center text-muted-foreground">
        <p class="text-xs">未匹配到相关测试任务</p>
      </div>

      <div v-else class="flex flex-col gap-1">
        <div
          v-for="task in testingStore.filteredTasks"
          :key="task.id"
          class="group relative flex flex-col gap-1 p-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer"
          :class="[
            testingStore.activeTaskId === task.id
              ? 'bg-primary/10 text-foreground border border-primary/20 shadow-xs'
              : 'hover:bg-accent/60 text-muted-foreground border border-transparent',
          ]"
          @click="testingStore.selectTask(task.id)"
        >
          <!-- Title Row & Status -->
          <div class="flex items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5 min-w-0">
              <!-- Status Dot -->
              <span
                class="w-2 h-2 rounded-full flex-shrink-0"
                :class="[
                  task.status === 'running'
                    ? 'bg-amber-500 animate-ping'
                    : task.status === 'success'
                    ? 'bg-emerald-500'
                    : task.status === 'failed'
                    ? 'bg-destructive'
                    : task.status === 'stopped'
                    ? 'bg-amber-400'
                    : 'bg-slate-300 dark:bg-slate-600',
                ]"
              />
              <span class="text-xs font-semibold truncate text-foreground">
                {{ task.name }}
              </span>
            </div>

            <!-- Category Tag -->
            <span class="text-[10px] px-1.5 py-0.2 rounded-md font-mono bg-muted/80 text-muted-foreground flex-shrink-0">
              {{ task.category }}
            </span>
          </div>

          <!-- Description Row -->
          <p class="text-[11px] text-muted-foreground/80 line-clamp-1 leading-snug">
            {{ task.description }}
          </p>

          <!-- Metrics / Performance Footer -->
          <div v-if="task.lastMetrics" class="mt-0.5 flex items-center gap-2 text-[10px] font-mono text-muted-foreground/70">
            <span>{{ (task.lastMetrics.totalDurationMs / 1000).toFixed(1) }}s</span>
            <span>{{ task.lastMetrics.totalTokens }} tok</span>
            <span>{{ task.lastMetrics.tps }} tps</span>
          </div>

          <!-- Delete Action on Hover -->
          <button
            v-if="testingStore.tasks.length > 1"
            type="button"
            title="删除任务"
            class="opacity-0 group-hover:opacity-100 absolute right-2 top-2 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity"
            @click.stop="testingStore.deleteTask(task.id)"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </AppleScrollArea>

    <!-- Bottom Actions: Preset Restore -->
    <div class="p-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
      <span>预设用例库</span>
      <button
        type="button"
        class="text-primary hover:underline flex items-center gap-1 font-medium transition-colors"
        @click="restoreDefaultTasks"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        恢复默认用例
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTestingStore } from "../../../stores/testing.js";
import { DEFAULT_TEST_TASKS } from "../../../stores/testing-presets.js";
import AppleScrollArea from "../../../components/ui/AppleScrollArea.vue";
import type { TaskCategory } from "../../../types/testing.js";

defineEmits<{
  (e: "open-create-modal"): void;
}>();

const testingStore = useTestingStore();

const categories: Array<{ id: TaskCategory; label: string }> = [
  { id: "all", label: "全部" },
  { id: "availability", label: "环境自检" },
  { id: "reasoning", label: "深度推理" },
  { id: "tools", label: "工具链" },
  { id: "speed", label: "基准测速" },
  { id: "custom", label: "自定义" },
];

function restoreDefaultTasks() {
  if (confirm("确定要将测试任务列表重置为初始预设吗？自定义任务将会被清空。")) {
    testingStore.tasks = JSON.parse(JSON.stringify(DEFAULT_TEST_TASKS));
    testingStore.selectTask(DEFAULT_TEST_TASKS[0].id);
  }
}
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
