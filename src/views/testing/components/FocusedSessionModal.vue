<template>
  <div
    v-if="isOpen && currentSession"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 backdrop-blur-md select-none animate-in fade-in duration-200"
    @click.self="closeModal"
  >
    <!-- Modal Dialog Window (Large Fullscreen Focus) -->
    <div
      class="w-full h-full max-w-6xl max-h-[92vh] rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-4 flex-shrink-0">
        <!-- Left: Model Info & Status -->
        <div class="flex items-center gap-3 min-w-0">
          <span
            class="w-2.5 h-2.5 rounded-full flex-shrink-0"
            :class="[
              isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-primary'
            ]"
          />
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-bold text-foreground truncate">
                {{ currentSession.modelName || currentSession.modelId }}
              </h2>
              <span class="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
                {{ currentSession.providerName || currentSession.providerId }}
              </span>
            </div>
            <div class="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
              <span>状态: {{ statusLabel }}</span>
              <span v-if="currentSession.workspaceDir">· 沙箱已就绪</span>
            </div>
          </div>
        </div>

        <!-- Right: Actions Toolbar & Close -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <!-- 1. 指标抽屉快捷触发 -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-card hover:bg-muted text-xs font-medium text-foreground transition-all"
            @click="openMetrics"
          >
            <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>时序指标</span>
          </button>

          <!-- 2. 打开工作空间 -->
          <button
            v-if="currentSession.workspaceDir"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
            @click="openWorkspace"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>打开工作空间</span>
          </button>

          <!-- 3. 关闭全屏模态框 -->
          <button
            type="button"
            class="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all ml-2"
            title="关闭放大视窗 (Esc)"
            @click="closeModal"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Modal Body: High Resolution Message Stream -->
      <div class="flex-1 min-h-0 overflow-hidden relative bg-background/50">
        <VirtualMessageList :messages="currentSession.messages || []" />
      </div>

      <!-- Modal Footer: Full Control Matrix & Micro Metrics -->
      <div class="px-6 py-4 border-t border-border/60 bg-card/90 backdrop-blur-xl flex flex-col gap-3 flex-shrink-0">
        <!-- Row 1: Dual TPS and Runtime Stats -->
        <div class="flex items-center justify-between gap-4 font-mono text-xs">
          <div class="flex items-center gap-3">
            <div class="px-3 py-1 rounded-lg bg-muted/60 border border-border/60 text-foreground flex items-center gap-2">
              <span class="text-muted-foreground font-sans text-[11px]">含首字 TPS</span>
              <span class="font-bold">
                {{ currentSession.metrics?.tpsWithTtft ? `${currentSession.metrics.tpsWithTtft} tps` : "--" }}
              </span>
            </div>

            <div class="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center gap-2">
              <span class="text-primary/70 font-sans text-[11px]">不含首字 TPS</span>
              <span class="font-bold">
                {{ currentSession.metrics?.tpsWithoutTtft ? `${currentSession.metrics.tpsWithoutTtft} tps` : "--" }}
              </span>
            </div>

            <div class="text-muted-foreground text-[11px] hidden sm:flex items-center gap-2 font-sans">
              <span>耗时: {{ ((currentSession.metrics?.totalDurationMs || 0) / 1000).toFixed(1) }}s</span>
              <span>·</span>
              <span>Tokens: {{ currentSession.metrics?.completionTokens || 0 }}</span>
              <span>·</span>
              <span>工具调用: {{ currentSession.metrics?.toolCallsCount || 0 }}</span>
            </div>
          </div>

          <div class="text-[11px] font-sans text-muted-foreground">
            按 <kbd class="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Esc</kbd> 退出全屏放大
          </div>
        </div>

        <!-- Row 2: Operation Bar -->
        <div class="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
          <div class="flex items-center gap-2">
            <!-- Start Button (if idle) -->
            <button
              v-if="currentSession.status === 'idle'"
              type="button"
              class="px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95"
              @click="testingStore.startSession(currentSession.id)"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>执行测试</span>
            </button>

            <!-- Stop Button (if running) -->
            <button
              v-else-if="isRunning"
              type="button"
              class="px-5 py-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold shadow-sm flex items-center gap-2 animate-pulse transition-all active:scale-95"
              @click="testingStore.stopSession(currentSession.id)"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              <span>停止执行</span>
            </button>

            <!-- Continue Button (if not running) -->
            <template v-else>
              <button
                type="button"
                class="px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                @click="sendDefaultContinue"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span>继续测试 (默认指令)</span>
              </button>
            </template>
          </div>

          <!-- Continue Input Field (Always visible in focused fullscreen) -->
          <div v-if="!isRunning" class="flex-1 max-w-xl flex items-center gap-2">
            <input
              v-model="customPromptInput"
              type="text"
              placeholder="输入自定义后续指令继续测试..."
              class="flex-1 px-3.5 py-2 text-xs bg-muted/40 border border-border/60 rounded-xl placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              @keydown.enter.prevent="sendCustomContinue"
            />
            <button
              type="button"
              class="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all shadow-xs flex-shrink-0"
              @click="sendCustomContinue"
            >
              发送指令
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useTestingStore } from "../../../stores/testing.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import type { TestSession } from "../../../types/testing.js";
import VirtualMessageList from "./VirtualMessageList.vue";

const testingStore = useTestingStore();
const drawerStore = useDrawerStore();

const customPromptInput = ref("");

const isOpen = computed(() => !!drawerStore.focusedModalSessionId);

const currentSession = computed<TestSession | null>(() => {
  const sid = drawerStore.focusedModalSessionId;
  if (!sid) return null;
  return testingStore.sessions[sid] || null;
});

const isRunning = computed(() => {
  if (!currentSession.value) return false;
  return currentSession.value.status === "running" || currentSession.value.status === "preparing";
});

const statusLabel = computed(() => {
  if (!currentSession.value) return "";
  switch (currentSession.value.status) {
    case "preparing": return "正在准备沙箱...";
    case "running": return "Agent 执行中";
    case "completed": return "测试完成";
    case "failed": return "执行异常";
    case "stopped": return "已手动中止";
    default: return "待测试";
  }
});

function closeModal() {
  drawerStore.closeFocusedModal();
}

function openMetrics() {
  if (currentSession.value) {
    drawerStore.openTestMetrics(currentSession.value.id);
  }
}

async function openWorkspace() {
  if (!currentSession.value?.workspaceDir) return;
  try {
    await invoke("open_workspace_in_explorer", {
      workspaceDir: currentSession.value.workspaceDir,
    });
  } catch (err) {
    console.error("打开工作空间失败", err);
  }
}

function sendDefaultContinue() {
  if (!currentSession.value) return;
  testingStore.continueSession(currentSession.value.id, "请继续完成后续任务与验证并报告结果");
}

function sendCustomContinue() {
  if (!currentSession.value || !customPromptInput.value.trim()) return;
  testingStore.continueSession(currentSession.value.id, customPromptInput.value.trim());
  customPromptInput.value = "";
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && isOpen.value) {
    closeModal();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});
</script>
