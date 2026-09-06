<template>
  <div
    class="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 select-none text-[11px]"
    :class="props.class"
  >
    <!-- Option 1: Unset / Inherit -->
    <button
      type="button"
      :disabled="props.disabled"
      class="px-2 py-1 rounded-md font-medium transition-all duration-150 flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      :class="[
        currentMode === 'inherit'
          ? 'bg-background text-foreground shadow-xs shadow-black/5 font-semibold'
          : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5',
      ]"
      @click="select('inherit')"
    >
      <span class="w-1.5 h-1.5 rounded-full" :class="inheritDotClass" />
      <span>{{ inheritLabelText }}</span>
    </button>

    <!-- Option 2: Explicit True (Enable) -->
    <button
      type="button"
      :disabled="props.disabled"
      class="px-2 py-1 rounded-md font-medium transition-all duration-150 flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      :class="[
        currentMode === 'true'
          ? 'bg-primary text-primary-foreground shadow-xs shadow-primary/20 font-semibold'
          : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5',
      ]"
      @click="select('true')"
    >
      <span class="w-1.5 h-1.5 rounded-full" :class="currentMode === 'true' ? 'bg-white' : 'bg-primary/60'" />
      <span>{{ trueLabel }}</span>
    </button>

    <!-- Option 3: Explicit False (Disable) -->
    <button
      type="button"
      :disabled="props.disabled"
      class="px-2 py-1 rounded-md font-medium transition-all duration-150 flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      :class="[
        currentMode === 'false'
          ? 'bg-amber-600 dark:bg-amber-500 text-white shadow-xs shadow-amber-500/20 font-semibold'
          : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5',
      ]"
      @click="select('false')"
    >
      <span class="w-1.5 h-1.5 rounded-full" :class="currentMode === 'false' ? 'bg-white' : 'bg-amber-500/60'" />
      <span>{{ falseLabel }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  /**
   * 当前值：true | false | undefined
   */
  modelValue?: boolean;
  /**
   * 组件类型：
   * - 'provider': 未配置时显示 "未配置 (默认: 开/关)"
   * - 'model': 未配置时显示 "继承 (当前: 开/关)"
   */
  type?: "provider" | "model";
  /**
   * 当 modelValue 为 undefined 时，底层默认推导的值（用于提示用户未配置时的实际生效效果）
   */
  fallbackValue?: boolean;
  /**
   * 显式开启的文字标签，默认为 "开启"
   */
  trueLabel?: string;
  /**
   * 显式关闭的文字标签，默认为 "关闭"
   */
  falseLabel?: string;
  disabled?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  type: "provider",
  fallbackValue: false,
  trueLabel: "开启",
  falseLabel: "关闭",
  disabled: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean | undefined): void;
  (e: "change", value: boolean | undefined): void;
}>();

const currentMode = computed<"inherit" | "true" | "false">(() => {
  if (props.modelValue === undefined || props.modelValue === null) {
    return "inherit";
  }
  return props.modelValue ? "true" : "false";
});

const inheritLabelText = computed(() => {
  const fallbackStr = props.fallbackValue ? "开" : "关";
  if (props.type === "model") {
    return `继承 (${fallbackStr})`;
  }
  return `未配置 (${fallbackStr})`;
});

const inheritDotClass = computed(() => {
  if (currentMode.value === "inherit") {
    return props.fallbackValue ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-500";
  }
  return "bg-slate-300 dark:bg-slate-600";
});

function select(mode: "inherit" | "true" | "false") {
  if (props.disabled) return;
  let nextValue: boolean | undefined;
  if (mode === "inherit") {
    nextValue = undefined;
  } else if (mode === "true") {
    nextValue = true;
  } else {
    nextValue = false;
  }
  emit("update:modelValue", nextValue);
  emit("change", nextValue);
}
</script>
