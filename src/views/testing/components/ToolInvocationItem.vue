<template>
  <div
    class="mb-3 rounded-2xl border transition-all duration-200 overflow-hidden bg-card/60 backdrop-blur-sm"
    :class="[
      tool.state === 'call' || tool.state === 'partial-call'
        ? 'border-amber-500/30 bg-amber-500/5'
        : tool.error
        ? 'border-destructive/30 bg-destructive/5'
        : 'border-slate-200/80 dark:border-slate-800/80',
    ]"
  >
    <!-- Header Bar (Click to toggle collapse) -->
    <button
      type="button"
      class="w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
      @click="isCollapsed = !isCollapsed"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <!-- Wrench / Tool SVG Icon -->
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          :class="[
            tool.state === 'call' || tool.state === 'partial-call'
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              : tool.error
              ? 'bg-destructive/20 text-destructive'
              : 'bg-primary/10 text-primary',
          ]"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <!-- Tool Name & Call ID -->
        <div class="flex items-baseline gap-2 min-w-0">
          <span class="text-xs font-mono font-bold text-foreground truncate">
            {{ tool.toolName }}
          </span>
          <span class="text-[10px] font-mono text-muted-foreground/60 truncate hidden sm:inline">
            {{ tool.toolCallId }}
          </span>
        </div>

        <!-- State Badge -->
        <span
          v-if="tool.state === 'call' || tool.state === 'partial-call'"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400"
        >
          <svg class="animate-spin w-2.5 h-2.5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          执行中
        </span>

        <span
          v-else-if="tool.error"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/15 text-destructive"
        >
          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          执行异常
        </span>

        <span
          v-else
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        >
          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          已返回结果
        </span>
      </div>

      <!-- Right: Execution Time & Chevron Toggle -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <span v-if="tool.executionTimeMs" class="text-[11px] font-mono text-muted-foreground/70">
          {{ tool.executionTimeMs }}ms
        </span>
        <div class="flex items-center text-muted-foreground transition-transform duration-200" :class="{ 'rotate-180': !isCollapsed }">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </button>

    <!-- Expanded Body -->
    <div
      v-show="!isCollapsed"
      class="px-3.5 pb-3.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col gap-3"
    >
      <!-- Arguments Section -->
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between text-[11px] text-muted-foreground">
          <span class="font-medium">调用入参 (Arguments)</span>
          <button
            type="button"
            class="hover:text-foreground transition-colors text-[10px] flex items-center gap-1"
            @click="copyText(formattedArgs, 'args')"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {{ copiedKey === 'args' ? '已复制' : '复制 JSON' }}
          </button>
        </div>
        <pre class="bg-slate-900 text-slate-100 p-2.5 rounded-xl text-[11px] font-mono overflow-x-auto select-text leading-relaxed">{{ formattedArgs }}</pre>
      </div>

      <!-- Result Section (if any) -->
      <div v-if="tool.state === 'result'" class="flex flex-col gap-1">
        <div class="flex items-center justify-between text-[11px] text-muted-foreground">
          <span class="font-medium">工具执行结果 (Result)</span>
          <button
            type="button"
            class="hover:text-foreground transition-colors text-[10px] flex items-center gap-1"
            @click="copyText(formattedResult, 'result')"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {{ copiedKey === 'result' ? '已复制' : '复制结果' }}
          </button>
        </div>
        <pre class="bg-slate-900 text-emerald-400 p-2.5 rounded-xl text-[11px] font-mono overflow-x-auto select-text leading-relaxed">{{ formattedResult }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { ToolInvocationState } from "../../../types/testing.js";

const props = defineProps<{
  tool: ToolInvocationState;
}>();

const isCollapsed = ref(props.tool.isCollapsed ?? true);
const copiedKey = ref<string | null>(null);

watch(
  () => props.tool.isCollapsed,
  (val) => {
    if (val !== undefined) {
      isCollapsed.value = val;
    }
  }
);

const formattedArgs = computed(() => {
  try {
    return JSON.stringify(props.tool.args, null, 2);
  } catch {
    return String(props.tool.args);
  }
});

const formattedResult = computed(() => {
  if (props.tool.result === undefined) return "undefined";
  if (typeof props.tool.result === "string") return props.tool.result;
  try {
    return JSON.stringify(props.tool.result, null, 2);
  } catch {
    return String(props.tool.result);
  }
});

async function copyText(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedKey.value = key;
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null;
    }, 1500);
  } catch (err) {
    console.error("复制失败", err);
  }
}
</script>
