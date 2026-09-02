<template>
  <Teleport to="body">
    <Transition name="sheet-backdrop">
      <div
        v-if="props.modelValue"
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
        @click="close"
      />
    </Transition>

    <Transition name="sheet-slide">
      <div
        v-if="props.modelValue"
        class="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-card/50 backdrop-blur-md">
          <div>
            <h3 class="text-base font-semibold text-foreground">
              {{ props.title }}
            </h3>
            <p v-if="props.description" class="text-xs text-muted-foreground mt-0.5">
              {{ props.description }}
            </p>
          </div>
          <button
            type="button"
            class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            @click="close"
          >
            <!-- Close SVG Icon -->
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body with AppleScrollArea -->
        <AppleScrollArea class="flex-1 px-6 py-5">
          <slot />
        </AppleScrollArea>

        <!-- Footer -->
        <div v-if="$slots.footer" class="px-6 py-4 border-t border-border bg-card/50 backdrop-blur-md flex items-center justify-end gap-3">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import AppleScrollArea from "./AppleScrollArea.vue";

interface Props {
  modelValue: boolean;
  title: string;
  description?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "close"): void;
}>();

function close() {
  emit("update:modelValue", false);
  emit("close");
}
</script>

<style scoped>
.sheet-backdrop-enter-active,
.sheet-backdrop-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-backdrop-enter-from,
.sheet-backdrop-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateX(100%);
}
</style>
