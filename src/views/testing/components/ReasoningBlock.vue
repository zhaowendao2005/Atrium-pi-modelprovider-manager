<template>
  <div
    class="mb-3 rounded-2xl border transition-all duration-200 overflow-hidden"
    :class="[
      reasoning.state === 'streaming'
        ? 'border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-500/10'
        : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40',
    ]"
  >
    <!-- Header Summary Bar (Click to toggle collapse) -->
    <button
      type="button"
      class="w-full px-3.5 py-2 flex items-center justify-between text-left transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
      @click="isCollapsed = !isCollapsed"
    >
      <div class="flex items-center gap-2 min-w-0">
        <!-- Brain / Reasoning SVG Icon -->
        <div
          class="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
          :class="[
            reasoning.state === 'streaming'
              ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
              : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
          ]"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>

        <span class="text-xs font-semibold text-foreground truncate">
          {{ reasoning.state === 'streaming' ? '思考中 (Reasoning...)' : '深度思考过程' }}
        </span>

        <!-- Pulse Badge if streaming -->
        <span
          v-if="reasoning.state === 'streaming'"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 animate-pulse"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          生成推理流
        </span>

        <!-- Duration badge if completed -->
        <span
          v-else-if="reasoning.durationMs"
          class="text-[11px] text-muted-foreground/80 font-mono"
        >
          耗时 {{ (reasoning.durationMs / 1000).toFixed(1) }}s
        </span>
      </div>

      <!-- Chevron Arrow SVG -->
      <div class="flex items-center text-muted-foreground transition-transform duration-200" :class="{ 'rotate-180': !isCollapsed }">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>

    <!-- Expanded Reasoning Content -->
    <div
      v-show="!isCollapsed"
      class="px-3.5 pb-3 pt-1 border-t border-slate-200/50 dark:border-slate-800/50"
    >
      <div class="text-xs font-mono text-muted-foreground/90 leading-relaxed whitespace-pre-wrap select-text">
        {{ reasoning.content }}
        <span
          v-if="reasoning.state === 'streaming'"
          class="inline-block w-1.5 h-3.5 ml-0.5 bg-indigo-500 animate-pulse align-middle"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { ReasoningData } from "../../../types/testing.js";

const props = defineProps<{
  reasoning: ReasoningData;
}>();

// 默认在流式中保持展开，流式完成后折叠
const isCollapsed = ref(props.reasoning.collapsed ?? false);

watch(
  () => props.reasoning.collapsed,
  (val) => {
    if (val !== undefined) {
      isCollapsed.value = val;
    }
  }
);
</script>
