<template>
  <Sheet
    :model-value="drawerStore.isTestTaskDetailsOpen"
    :title="task?.name || '任务详情'"
    description="任务场景元数据、沙箱隔离环境与执行目标"
    max-width-class="max-w-xl"
    @update:model-value="onOpenChange"
  >
    <div class="flex flex-col gap-5 py-1">
      <!-- Section 1: 任务基本信息 -->
      <div class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-foreground/80 uppercase tracking-wider">基础信息</span>
          <Badge size="sm" variant="secondary" class="text-[10px] px-2 py-0.5">
            {{ task?.category }}
          </Badge>
        </div>

        <div class="bg-muted/40 border border-border/60 rounded-2xl p-3.5 flex flex-col gap-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">任务标识 (ID):</span>
            <span class="font-mono text-foreground font-medium">{{ task?.id }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">排序权重 (Order):</span>
            <span class="font-mono text-foreground font-medium">{{ task?.order ?? 0 }}</span>
          </div>
          <div class="flex items-start justify-between gap-4">
            <span class="text-muted-foreground flex-shrink-0">任务描述:</span>
            <span class="text-right text-foreground/90">{{ task?.description || "无描述" }}</span>
          </div>
        </div>
      </div>

      <!-- Section 2: 沙箱隔离工作空间 -->
      <div class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-foreground/80 uppercase tracking-wider">沙箱隔离环境</span>
          <span class="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
            外网访问 100% 拦截
          </span>
        </div>

        <div class="bg-muted/40 border border-border/60 rounded-2xl p-3.5 flex flex-col gap-2.5 text-xs">
          <div>
            <span class="text-muted-foreground block mb-1">物理工作空间路径:</span>
            <div
              class="font-mono text-[11px] p-2 rounded-xl bg-card border border-border/70 select-all break-all text-foreground"
            >
              {{ testingStore.currentWorkspaceDir || "尚未创建沙箱（执行测试时自动分配）" }}
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <span class="text-muted-foreground">网络策略:</span>
            <span class="font-mono text-foreground">
              {{ task?.allowNet ? "允许受控网络" : "纯离线沙箱 (Offline)" }}
            </span>
          </div>

          <div v-if="testingStore.currentWorkspaceDir" class="pt-1 flex justify-end">
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors"
              @click="testingStore.openCurrentWorkspace"
            >
              <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>在资源管理器中打开</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Section 3: 任务资料与产出规范 -->
      <div class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-foreground/80 uppercase tracking-wider">技术资料与产出</span>
          <button
            v-if="hasMaterials"
            type="button"
            class="text-[11px] text-primary hover:underline font-medium"
            @click="openMaterialsSheet"
          >
            打开完整资料抽屉
          </button>
        </div>

        <div class="bg-muted/40 border border-border/60 rounded-2xl p-3.5 flex flex-col gap-2.5 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">计划文档 (plan.md):</span>
            <span class="font-mono text-foreground font-medium">
              {{ task?.plan ? "已提供离线计划" : "无独立计划" }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">离线文档 (docs/):</span>
            <span class="font-mono text-foreground font-medium">
              {{ task?.docs?.length ? `${task.docs.length} 篇参考规范` : "无文档" }}
            </span>
          </div>
          <div v-if="task?.expectedOutputs?.length" class="flex flex-col gap-1.5 pt-1">
            <span class="text-muted-foreground">期望产出清单:</span>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="out in task.expectedOutputs"
                :key="out"
                class="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-card border border-border/60 text-foreground"
              >
                {{ out }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 4: 当前测试模型 -->
      <div class="flex flex-col gap-2.5">
        <span class="text-xs font-semibold text-foreground/80 uppercase tracking-wider">当前测试目标模型</span>
        <div class="bg-muted/40 border border-border/60 rounded-2xl p-3.5 flex flex-col gap-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">提供商 (Provider):</span>
            <span class="font-medium text-foreground">{{ currentTarget.providerName }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">模型 (Model):</span>
            <span class="font-mono text-foreground font-medium">{{ currentTarget.modelName }}</span>
          </div>
        </div>
      </div>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTestingStore } from "../../../stores/testing.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import Sheet from "../../../components/ui/Sheet.vue";
import Badge from "../../../components/ui/Badge.vue";

const testingStore = useTestingStore();
const drawerStore = useDrawerStore();

const task = computed(() => testingStore.activeTask);
const currentTarget = computed(() => testingStore.currentModelDisplay);

const hasMaterials = computed(() => {
  return Boolean(task.value?.plan || task.value?.docs?.length || task.value?.expectedOutputs?.length);
});

function onOpenChange(val: boolean) {
  if (!val) {
    drawerStore.closeTestTaskDetails();
  }
}

function openMaterialsSheet() {
  drawerStore.closeTestTaskDetails();
  drawerStore.openTestTaskMaterials("plan");
}
</script>
