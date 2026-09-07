<template>
  <div
    class="relative inline-flex items-center justify-center flex-shrink-0 select-none overflow-hidden rounded-lg transition-transform"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :class="props.class"
  >
    <!-- 命中提供商图标且加载成功 -->
    <img
      v-if="logoSrc && !imageError"
      :src="logoSrc"
      :alt="displayName"
      class="w-full h-full object-contain p-0.5 filter drop-shadow-xs"
      loading="lazy"
      @error="imageError = true"
    />

    <!-- 降级兜底：精致的精细 SVG 厂商接入网关图标 (零 Emoji) -->
    <div
      v-else
      class="w-full h-full rounded-lg bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/60 flex items-center justify-center text-muted-foreground shadow-xs"
    >
      <svg
        class="w-3/5 h-3/5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.75"
          d="M5 12h14M12 5l7 7-7 7"
        />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { getProviderLogo } from "../../utils/provider-logo.js";

const props = withDefaults(
  defineProps<{
    provider?: {
      id?: string;
      name?: string;
      appliedPreset?: string;
      basePresetId?: string;
    };
    size?: number;
    class?: string;
  }>(),
  {
    size: 22,
  }
);

const imageError = ref(false);

const displayName = computed(() => {
  return props.provider?.name || props.provider?.id || "Provider";
});

const logoSrc = computed(() => {
  return getProviderLogo(props.provider);
});

watch(logoSrc, () => {
  imageError.value = false;
});
</script>
