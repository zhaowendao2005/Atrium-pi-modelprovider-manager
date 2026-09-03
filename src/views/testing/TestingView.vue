<template>
  <div class="flex h-full w-full overflow-hidden select-none">
    <!-- Left Column: Test Tasks List Sidebar -->
    <TaskSidebarList @open-create-modal="isCreateModalOpen = true" />

    <!-- Right Column: Active Task Testing Workspace & Stream Messages -->
    <div class="flex-1 h-full flex flex-col min-w-0 bg-background/50 overflow-hidden">
      <!-- Inner Header: 极简通透，纯粹呈现当前测试场景与沙箱状态 (模型选择移至控制台) -->
      <div class="px-5 py-3 border-b border-border/60 bg-card/40 backdrop-blur-md flex items-center justify-between gap-4 flex-shrink-0">
        <!-- Left: Task Name, Category Badge & Description -->
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          <h2 class="text-sm font-bold text-foreground truncate max-w-md" :title="testingStore.activeTask.name">
            {{ testingStore.activeTask.name }}
          </h2>

          <Badge size="sm" variant="secondary" class="text-[10px] px-2 py-0.5 whitespace-nowrap flex-shrink-0">
            {{ testingStore.activeTask.category }}
          </Badge>

          <span v-if="testingStore.activeTask.description" class="hidden md:inline text-xs text-muted-foreground/70 truncate max-w-sm">
            {{ testingStore.activeTask.description }}
          </span>
        </div>

        <!-- Right: Workspace Folder Pill & Status Indicator -->
        <div class="flex items-center gap-2.5 flex-shrink-0">
          <!-- Active Workspace Folder Tag & Open Explorer Button -->
          <div
            v-if="testingStore.currentWorkspaceDir"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted/80 border border-border/50 text-[11px] font-mono text-muted-foreground transition-colors whitespace-nowrap flex-shrink-0"
          >
            <span class="text-foreground/80 truncate max-w-[130px]" :title="testingStore.currentWorkspaceDir">
              {{ testingStore.workspaceShortName }}
            </span>
            <button
              type="button"
              title="在 Windows 资源管理器中打开工作空间"
              class="p-0.5 text-muted-foreground hover:text-primary transition-colors"
              @click="testingStore.openCurrentWorkspace"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>

          <!-- Running state animation / Ready Badge -->
          <div
            v-if="testingStore.isRunning"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap flex-shrink-0"
          >
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Agent 运行中</span>
          </div>
          <div
            v-else
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/40 text-xs font-medium text-muted-foreground whitespace-nowrap flex-shrink-0"
          >
            <span class="w-2 h-2 rounded-full bg-slate-400" />
            <span>就绪</span>
          </div>
        </div>
      </div>

      <!-- Center: Message Stream Area (Virtual Scrolling & High-performance rendering) -->
      <div class="flex-1 min-h-0 overflow-hidden relative">
        <VirtualMessageList :messages="testingStore.messages" />
      </div>

      <!-- Bottom: Operation Console (Replaces traditional chat input) -->
      <TestControlConsole />
    </div>

    <!-- Task Creation Modal -->
    <TaskEditModal v-model="isCreateModalOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useTestingStore } from "../../stores/testing.js";
import { useProviderStore } from "../../stores/provider.js";
import TaskSidebarList from "./components/TaskSidebarList.vue";
import VirtualMessageList from "./components/VirtualMessageList.vue";
import TestControlConsole from "./components/TestControlConsole.vue";
import TaskEditModal from "./components/TaskEditModal.vue";
import Badge from "../../components/ui/Badge.vue";

const testingStore = useTestingStore();
const providerStore = useProviderStore();

const isCreateModalOpen = ref(false);

onMounted(() => {
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
