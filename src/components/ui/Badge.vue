<template>
  <span
    class="inline-flex items-center gap-1 font-medium select-none"
    :class="[
      variantClasses,
      sizeClasses,
      props.class,
    ]"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "purple";
  size?: "sm" | "md";
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "default",
  size: "md",
});

const variantClasses = computed(() => {
  switch (props.variant) {
    case "default":
      return "bg-primary/15 text-primary border border-primary/20";
    case "secondary":
      return "bg-secondary text-secondary-foreground border border-border/50";
    case "outline":
      return "border border-border text-foreground";
    case "success":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    case "warning":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    case "destructive":
      return "bg-destructive/15 text-destructive border border-destructive/20";
    case "purple":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20";
    default:
      return "bg-primary/15 text-primary border border-primary/20";
  }
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "text-[11px] px-2 py-0.5 rounded-md";
    case "md":
      return "text-xs px-2.5 py-1 rounded-lg";
    default:
      return "text-xs px-2.5 py-1 rounded-lg";
  }
});
</script>
