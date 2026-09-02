<template>
  <button
    :type="props.type || 'button'"
    :disabled="props.disabled || props.loading"
    class="inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 select-none"
    :class="[
      variantClasses,
      sizeClasses,
      props.class,
    ]"
    @click="$emit('click', $event)"
  >
    <!-- Loading Spinner (SVG) -->
    <svg
      v-if="props.loading"
      class="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "primary",
  size: "md",
  type: "button",
  disabled: false,
  loading: false,
});

defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

const variantClasses = computed(() => {
  switch (props.variant) {
    case "primary":
      return "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20";
    case "secondary":
      return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    case "outline":
      return "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground";
    case "ghost":
      return "bg-transparent hover:bg-accent hover:text-accent-foreground";
    case "destructive":
      return "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm shadow-destructive/20";
    default:
      return "bg-primary text-primary-foreground hover:bg-primary/90";
  }
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "h-8 px-3 text-xs rounded-lg gap-1.5";
    case "md":
      return "h-9 px-4 text-sm rounded-xl gap-2";
    case "lg":
      return "h-11 px-6 text-base rounded-xl gap-2.5";
    case "icon":
      return "h-9 w-9 p-0 rounded-xl justify-center";
    default:
      return "h-9 px-4 text-sm rounded-xl gap-2";
  }
});
</script>
