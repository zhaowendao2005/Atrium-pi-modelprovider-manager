<template>
  <div class="h-full w-full flex flex-col min-w-0 bg-background/60 overflow-hidden select-none">
    <!-- Top Matrix Control Header -->
    <div class="px-6 py-3 border-b border-border/70 bg-card/60 backdrop-blur-md flex items-center justify-between gap-4 flex-shrink-0">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-bold text-foreground truncate">
              多模型批量横向评测看板
            </h2>
            <span class="text-xs text-muted-foreground">/</span>
            <span class="text-xs font-medium text-foreground/80 truncate">
              {{ testingStore.activeTask.name }}
            </span>
          </div>
          <p class="text-[11px] text-muted-foreground/70">
            同任务多模型自动化沙箱运行对比矩阵
          </p>
        </div>
      </div>

      <!-- Stats & Actions -->
      <div class="flex items-center gap-3 flex-shrink-0">
        <!-- Progress Capsule -->
        <div class="flex items-center gap-2 px-3 py-1 rounded-xl bg-muted/50 border border-border/60 text-xs font-mono">
          <span class="text-muted-foreground font-sans">进度:</span>
          <span class="font-bold text-foreground">
            {{ completedCount }}/{{ testingStore.batchCards.length }}
          </span>
          <span v-if="runningCount > 0" class="flex items-center gap-1 text-emerald-500 font-sans">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {{ runningCount }} 运行中
          </span>
        </div>

        <!-- Stop / Control Button -->
        <Button
          v-if="testingStore.isBatchRunning"
          variant="destructive"
          size="sm"
          class="gap-1.5"
          @click="testingStore.stopBatchTest"
        >
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          <span>中断批量评测</span>
        </Button>

        <!-- Exit Batch View Button -->
        <Button
          variant="outline"
          size="sm"
          class="gap-1.5"
          @click="testingStore.exitBatchMode"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>返回单模型调试</span>
        </Button>
      </div>
    </div>

    <!-- Main Card Grid Area with AppleScrollArea -->
    <AppleScrollArea class="flex-1 p-5">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <!-- One Large Card Per Model -->
        <div
          v-for="card in testingStore.batchCards"
          :key="card.id"
          class="bg-card/80 border rounded-2xl p-4 shadow-sm flex flex-col gap-3 transition-all duration-200"
          :class="[
            card.status === 'running'
              ? 'border-primary/50 shadow-md shadow-primary/10 ring-1 ring-primary/30'
              : card.status === 'completed'
              ? 'border-emerald-500/30'
              : card.status === 'failed'
              ? 'border-destructive/30'
              : 'border-border/60',
          ]"
        >
          <!-- Card Header: Model Name & Status -->
          <div class="flex items-start justify-between gap-3 pb-2.5 border-b border-border/50">
            <div class="min-w-0">
              <h3 class="text-sm font-bold text-foreground truncate" :title="card.target.modelName">
                {{ card.target.modelName }}
              </h3>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-[11px] text-muted-foreground font-medium truncate">
                  {{ card.target.providerName }}
                </span>
                <span class="text-muted-foreground/30">•</span>
                <span class="text-[10px] font-mono text-muted-foreground/60 truncate">
                  {{ card.target.modelId }}
                </span>
              </div>
            </div>

            <!-- Status Badge -->
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex-shrink-0" :class="statusClass(card.status)">
              <span
                v-if="card.status === 'running'"
                class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"
              />
              <span
                v-else
                class="w-1.5 h-1.5 rounded-full"
                :class="statusDotClass(card.status)"
              />
              <span>{{ statusLabel(card.status) }}</span>
            </div>
          </div>

          <!-- Real-time Performance Strip -->
          <div class="grid grid-cols-3 gap-1.5 font-mono text-xs">
            <!-- 含首字 TPS -->
            <div class="p-2 rounded-xl bg-muted/40 border border-border/40 flex flex-col gap-0.5">
              <span class="text-[10px] font-sans text-muted-foreground">含首字 TPS</span>
              <span class="font-bold text-foreground">
                {{ card.metrics.tpsWithTtft ? `${card.metrics.tpsWithTtft} tps` : '--' }}
              </span>
            </div>

            <!-- 不含首字 TPS -->
            <div class="p-2 rounded-xl bg-primary/10 border border-primary/20 flex flex-col gap-0.5 text-primary">
              <span class="text-[10px] font-sans text-primary/70">不含首字 TPS</span>
              <span class="font-bold">
                {{ card.metrics.tpsWithoutTtft ? `${card.metrics.tpsWithoutTtft} tps` : '--' }}
              </span>
            </div>

            <!-- 首字延迟 TTFT -->
            <div class="p-2 rounded-xl bg-muted/40 border border-border/40 flex flex-col gap-0.5">
              <span class="text-[10px] font-sans text-muted-foreground">首字延迟</span>
              <span class="font-bold text-foreground">
                {{ card.metrics.firstTokenMs ? `${card.metrics.firstTokenMs}ms` : '--' }}
              </span>
            </div>

            <!-- 总耗时 -->
            <div class="p-2 rounded-xl bg-muted/40 border border-border/40 flex flex-col gap-0.5">
              <span class="text-[10px] font-sans text-muted-foreground">耗时</span>
              <span class="font-bold text-foreground">
                {{ (card.metrics.totalDurationMs / 1000).toFixed(1) }}s
              </span>
            </div>

            <!-- Tokens -->
            <div class="p-2 rounded-xl bg-muted/40 border border-border/40 flex flex-col gap-0.5">
              <span class="text-[10px] font-sans text-muted-foreground">Tokens</span>
              <span class="font-bold text-foreground">
                {{ card.metrics.completionTokens || card.metrics.totalTokens || '--' }}
              </span>
            </div>

            <!-- 工具调用数 -->
            <div class="p-2 rounded-xl bg-muted/40 border border-border/40 flex flex-col gap-0.5">
              <span class="text-[10px] font-sans text-muted-foreground">工具调用</span>
              <span class="font-bold text-foreground">
                {{ card.metrics.toolCallsCount }} 次
              </span>
            </div>
          </div>

          <!-- Live Stream Mini Terminal / Monitor -->
          <div class="rounded-xl bg-slate-950/90 text-slate-200 border border-slate-800 p-3 flex flex-col gap-2 font-mono text-[11px]">
            <!-- Terminal Header -->
            <div class="flex items-center justify-between text-[10px] text-slate-400 pb-1.5 border-b border-slate-800/80">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-slate-700 inline-block" />
                <span class="w-2 h-2 rounded-full bg-slate-700 inline-block" />
                <span class="w-2 h-2 rounded-full bg-slate-700 inline-block" />
                <span class="ml-1 font-sans">终端实时监控 (Live Monitor)</span>
              </div>
              <span v-if="card.status === 'running'" class="text-emerald-400 animate-pulse font-sans">
                LIVE
              </span>
            </div>

            <!-- Current Action Snippet -->
            <div v-if="card.currentActionText" class="text-indigo-300 truncate text-[10px]">
              &gt; {{ card.currentActionText }}
            </div>

            <!-- Recent Log Lines -->
            <div class="flex flex-col gap-1 max-h-24 overflow-y-auto no-scrollbar text-slate-300">
              <div
                v-for="(line, lIdx) in card.liveLogs.slice(-5)"
                :key="lIdx"
                class="leading-tight text-[10px] opacity-90 break-all"
              >
                {{ line }}
              </div>
            </div>
          </div>

          <!-- Tools Invoked Badges -->
          <div v-if="card.toolNames.length > 0" class="flex flex-wrap items-center gap-1 text-[10px] font-mono">
            <span class="text-muted-foreground font-sans">调用工具:</span>
            <span
              v-for="t in card.toolNames"
              :key="t"
              class="px-1.5 py-0.2 rounded bg-muted text-foreground/80 border border-border/50"
            >
              {{ t }}
            </span>
          </div>

          <!-- Card Footer Actions -->
          <div class="pt-2 border-t border-border/40 flex items-center justify-between text-xs mt-auto">
            <span class="text-[10px] font-mono text-muted-foreground truncate max-w-[140px]" :title="card.workspaceDir">
              {{ card.workspaceDir ? shortWsName(card.workspaceDir) : '沙箱未就绪' }}
            </span>

            <button
              v-if="card.workspaceDir"
              type="button"
              class="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium"
              title="在 Windows 资源管理器中打开该模型的独立沙箱"
              @click="openCardWorkspace(card.workspaceDir)"
            >
              <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>打开沙箱</span>
            </button>
          </div>
        </div>
      </div>
    </AppleScrollArea>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useTestingStore } from "../../../stores/testing.js";
import AppleScrollArea from "../../../components/ui/AppleScrollArea.vue";
import Button from "../../../components/ui/Button.vue";

const testingStore = useTestingStore();

const completedCount = computed(() => {
  return testingStore.batchCards.filter((c) => c.status === "completed" || c.status === "failed").length;
});

const runningCount = computed(() => {
  return testingStore.batchCards.filter((c) => c.status === "running").length;
});

function statusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "评测中";
    case "completed":
      return "已完成";
    case "failed":
      return "异常";
    case "stopped":
      return "已停止";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "running":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    case "failed":
      return "bg-destructive/10 text-destructive border border-destructive/20";
    case "stopped":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    default:
      return "bg-muted text-muted-foreground border border-border/50";
  }
}

function statusDotClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500";
    case "failed":
      return "bg-destructive";
    case "stopped":
      return "bg-amber-500";
    default:
      return "bg-slate-400";
  }
}

function shortWsName(dir: string): string {
  const parts = dir.split(/[\\/]/);
  return parts[parts.length - 1] || dir;
}

async function openCardWorkspace(dir: string) {
  try {
    await invoke("open_workspace_in_explorer", { workspaceDir: dir });
  } catch (e) {
    console.error("打开工作空间失败", e);
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
