<template>
  <div
    class="relative inline-flex items-center justify-center flex-shrink-0 select-none transition-transform"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :class="props.class"
  >
    <!-- 命中有效 Logo 图片且未触发加载错误 -->
    <img
      v-if="logoSrc && !imageError"
      :src="logoSrc"
      :alt="displayName"
      class="w-full h-full object-contain rounded-full p-0.5 filter drop-shadow-xs"
      loading="lazy"
      @error="imageError = true"
    />

    <!-- 降级兜底：Apple 风格首字母多彩渐变徽标 (极简、无 Emoji) -->
    <div
      v-else
      class="w-full h-full rounded-full flex items-center justify-center font-bold shadow-xs tracking-tight text-white"
      :style="{ fontSize: `${Math.max(10, Math.floor(size * 0.42))}px` }"
      :class="avatarBgClass"
    >
      {{ avatarInitial }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { getModelLogo } from "../../utils/model-logo.js";
import { useSettingsStore } from "../../stores/settings.js";

const props = withDefaults(
  defineProps<{
    model?: {
      id?: string;
      name?: string;
      family?: string;
    };
    size?: number;
    class?: string;
  }>(),
  {
    size: 28,
  }
);

const settingsStore = useSettingsStore();
const imageError = ref(false);

const isDark = computed(() => {
  const theme = settingsStore.settings?.theme || "auto";
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
});

const displayName = computed(() => {
  return props.model?.name || props.model?.id || "Model";
});

const logoSrc = computed(() => {
  return getModelLogo(props.model, isDark.value);
});

// 当模型切换或主题切换重算后，重置错误状态
watch(logoSrc, () => {
  imageError.value = false;
});

const avatarInitial = computed(() => {
  const name = props.model?.name || props.model?.id || "AI";
  const lower = name.toLowerCase();
  if (lower.startsWith("claude")) return "C";
  if (lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("o4")) return "G";
  if (lower.startsWith("deepseek")) return "D";
  if (lower.startsWith("qwen") || lower.startsWith("qwq") || lower.startsWith("qvq")) return "Q";
  if (lower.startsWith("gemini")) return "Ge";
  if (lower.startsWith("mistral") || lower.startsWith("mixtral") || lower.startsWith("codestral")) return "M";
  if (lower.startsWith("llama")) return "L";
  if (lower.startsWith("glm") || lower.startsWith("chatglm")) return "GL";
  if (lower.startsWith("kimi") || lower.startsWith("moonshot")) return "K";
  if (lower.startsWith("minimax") || lower.startsWith("abab")) return "MM";
  if (lower.startsWith("yi")) return "Y";
  if (lower.startsWith("doubao")) return "DB";
  return name.slice(0, 2).toUpperCase();
});

const avatarBgClass = computed(() => {
  const name = (props.model?.name || props.model?.id || "").toLowerCase();
  if (name.includes("claude")) return "bg-gradient-to-tr from-amber-600 to-orange-500";
  if (name.includes("gpt") || name.includes("o1") || name.includes("o3") || name.includes("o4")) return "bg-gradient-to-tr from-emerald-600 to-teal-500";
  if (name.includes("deepseek")) return "bg-gradient-to-tr from-blue-600 to-indigo-500";
  if (name.includes("qwen") || name.includes("qwq")) return "bg-gradient-to-tr from-violet-600 to-purple-500";
  if (name.includes("gemini")) return "bg-gradient-to-tr from-cyan-600 to-blue-500";
  if (name.includes("mistral") || name.includes("mixtral")) return "bg-gradient-to-tr from-amber-500 to-yellow-600";
  if (name.includes("llama")) return "bg-gradient-to-tr from-sky-600 to-blue-600";
  if (name.includes("glm")) return "bg-gradient-to-tr from-blue-500 to-cyan-500";
  if (name.includes("kimi") || name.includes("moonshot")) return "bg-gradient-to-tr from-slate-700 to-slate-900";
  return "bg-gradient-to-tr from-slate-500 to-slate-700";
});
</script>
