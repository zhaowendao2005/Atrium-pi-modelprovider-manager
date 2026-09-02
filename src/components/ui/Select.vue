<template>
  <div class="relative w-full">
    <select
      :value="props.modelValue"
      :disabled="props.disabled"
      class="w-full appearance-none bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 pr-9 text-sm text-foreground transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      :class="props.class"
      @change="handleChange"
    >
      <option
        v-for="opt in props.options"
        :key="opt.value"
        :value="opt.value"
        class="bg-card text-card-foreground"
      >
        {{ opt.label }}
      </option>
    </select>
    <!-- Chevron Down Icon (SVG) -->
    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface SelectOption {
  label: string;
  value: string | number;
}

interface Props {
  modelValue?: string | number;
  options: SelectOption[];
  disabled?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  disabled: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "change", value: string): void;
}>();

function handleChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  emit("update:modelValue", target.value);
  emit("change", target.value);
}
</script>
