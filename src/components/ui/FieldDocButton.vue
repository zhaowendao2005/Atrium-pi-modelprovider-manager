<template>
  <button
    type="button"
    class="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary ml-1"
    :title="`查看「${props.title || props.field}」字段详细说明`"
    @click.stop="openDoc"
  >
    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { useDrawerStore } from "../../stores/windows/drawer.js";

interface Props {
  field: string;
  title?: string;
}

const props = defineProps<Props>();
const drawerStore = useDrawerStore();

function openDoc() {
  drawerStore.openFieldDoc(props.field);
}
</script>
