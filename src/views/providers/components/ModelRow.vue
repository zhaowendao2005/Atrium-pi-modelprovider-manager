<template>
  <div class="group px-4 py-2.5 flex items-center justify-between border-t border-border/40 hover:bg-accent/40 transition-colors select-none">
    <!-- Left: Avatar + Model Name / ID -->
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <!-- Family / Model Avatar Circle (SVG) -->
      <div
        class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shadow-sm flex-shrink-0"
        :class="avatarBgClass"
      >
        <span class="text-white tracking-tight">{{ avatarInitial }}</span>
      </div>

      <div class="flex items-baseline gap-2 min-w-0 flex-wrap">
        <span class="font-medium text-xs text-foreground truncate">
          {{ props.model.name || props.model.id }}
        </span>
        <span
          v-if="props.model.name && props.model.name !== props.model.id"
          class="text-[11px] font-mono text-muted-foreground/70 truncate"
        >
          {{ props.model.id }}
        </span>
        <!-- Overridden Wire Protocol Badge -->
        <span
          v-if="props.model.api"
          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
          :title="`覆盖通信协议为: ${props.model.api}`"
        >
          {{ props.model.api }}
        </span>
        <!-- Custom Base URL Badge -->
        <span
          v-if="props.model.baseUrl"
          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          :title="`自定义独立路由: ${props.model.baseUrl}`"
        >
          独立端点
        </span>
      </div>
    </div>

    <!-- Right: Capability Icons & Action Buttons (SVG with Tooltip) -->
    <div class="flex items-center gap-1.5 flex-shrink-0">
      <!-- 1. Vision Capability (Eye SVG) -->
      <div
        class="p-1.5 rounded-lg transition-colors"
        :class="[
          hasVision
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default'
            : 'text-muted-foreground/30',
        ]"
        :title="hasVision ? '支持视觉图像多模态输入' : '纯文本模型'"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </div>

      <!-- 2. Reasoning Capability (Lightbulb SVG) -->
      <div
        class="p-1.5 rounded-lg transition-colors"
        :class="[
          props.model.reasoning
            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 cursor-default'
            : 'text-muted-foreground/30',
        ]"
        :title="props.model.reasoning ? '支持深度推理与思考链' : '标准响应模型'"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>

      <!-- 3. Specs / Context Tool (Wrench SVG) -->
      <div
        class="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 cursor-default transition-colors"
        :title="`上下文窗口: ${formatTokens(props.model.contextWindow || 128000)} | 最大输出: ${formatTokens(props.model.maxTokens || 16384)}`"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      <!-- 4. Sampling Params Indicator (Sliders SVG) -->
      <div
        v-if="hasSamplingParams"
        class="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 cursor-default transition-colors"
        title="已配置自定义采样参数注入 (samplingParams)"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </div>

      <!-- 5. Tiered Cost Indicator (Layers SVG) -->
      <div
        v-if="hasCostTiers"
        class="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default transition-colors"
        :title="`已启用阶梯费率 (${props.model.cost?.tiers?.length} 档阶梯定价)`"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>

      <!-- 4. Edit Settings (Cog SVG Button) -->
      <button
        type="button"
        title="配置模型参数与计费"
        class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        @click="editModel"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      <!-- 5. Delete Model (Minus SVG Button) -->
      <button
        type="button"
        title="移除模型"
        class="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        @click="deleteModel"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ModelSchema } from "../../../types/index.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import { useProviderStore } from "../../../stores/provider.js";

const props = defineProps<{
  model: ModelSchema;
  providerId: string;
}>();

const drawerStore = useDrawerStore();
const providerStore = useProviderStore();

const hasVision = computed(() => {
  return props.model.input?.includes("image") ?? false;
});

const hasSamplingParams = computed(() => {
  return !!props.model.samplingParams && Object.keys(props.model.samplingParams).length > 0;
});

const hasCostTiers = computed(() => {
  return !!props.model.cost?.tiers && props.model.cost.tiers.length > 0;
});

const avatarInitial = computed(() => {
  const name = props.model.name || props.model.id;
  if (name.toLowerCase().startsWith("claude")) return "C";
  if (name.toLowerCase().startsWith("gpt") || name.toLowerCase().startsWith("o1") || name.toLowerCase().startsWith("o3")) return "G";
  if (name.toLowerCase().startsWith("deepseek")) return "D";
  if (name.toLowerCase().startsWith("qwen") || name.toLowerCase().startsWith("qwq")) return "Q";
  if (name.toLowerCase().startsWith("gemini")) return "Ge";
  if (name.toLowerCase().startsWith("mistral")) return "M";
  if (name.toLowerCase().startsWith("llama")) return "L";
  return name.slice(0, 2).toUpperCase();
});

const avatarBgClass = computed(() => {
  const name = (props.model.name || props.model.id).toLowerCase();
  if (name.includes("claude")) return "bg-gradient-to-tr from-amber-600 to-orange-400";
  if (name.includes("gpt") || name.includes("o1") || name.includes("o3")) return "bg-gradient-to-tr from-emerald-600 to-teal-400";
  if (name.includes("deepseek")) return "bg-gradient-to-tr from-blue-600 to-cyan-400";
  if (name.includes("qwen") || name.includes("qwq")) return "bg-gradient-to-tr from-indigo-600 to-purple-400";
  if (name.includes("gemini")) return "bg-gradient-to-tr from-blue-500 to-indigo-500";
  return "bg-gradient-to-tr from-slate-600 to-slate-400";
});

function formatTokens(tokens: number) {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
  return `${tokens}`;
}

function editModel() {
  drawerStore.openModelDrawer("model-edit", props.providerId, props.model);
}

function deleteModel() {
  providerStore.deleteModel(props.providerId, props.model.id);
}
</script>
