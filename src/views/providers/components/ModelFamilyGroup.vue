<template>
  <div class="group/family border border-border/80 rounded-2xl overflow-hidden bg-card/60 transition-all shadow-sm">
    <!-- Level 1 Header: Family Accordion Trigger -->
    <div
      class="px-4 py-3 bg-muted/40 hover:bg-muted/70 flex items-center justify-between cursor-pointer transition-colors select-none"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-2.5">
        <!-- Chevron SVG Icon (rotates when expanded) -->
        <div
          class="text-muted-foreground transition-transform duration-200"
          :class="[isExpanded ? 'rotate-90' : 'rotate-0']"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        <!-- Family Brand Logo -->
        <ModelLogo :model="{ id: props.family, family: props.family }" :size="20" class="rounded-md" />

        <span class="font-semibold text-xs text-foreground tracking-tight">
          {{ props.family }}
        </span>

        <span class="text-[11px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-mono">
          {{ props.models.length }}
        </span>
      </div>

      <!-- Right: Delete Entire Family Button (Directly deletes without confirmation) -->
      <button
        type="button"
        class="opacity-0 group-hover/family:opacity-100 hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all flex items-center gap-1 text-[11px]"
        title="直接移除该系列所有模型"
        @click.stop="deleteFamily"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span class="hidden sm:inline">删除系列</span>
      </button>
    </div>

    <!-- Level 2 Body: Single-line Model Rows -->
    <div v-show="isExpanded" class="flex flex-col">
      <ModelRow
        v-for="model in props.models"
        :key="model.id"
        :model="model"
        :provider-id="props.providerId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { ModelSchema } from "../../../types/index.js";
import { useProviderStore } from "../../../stores/provider.js";
import ModelLogo from "../../../components/ui/ModelLogo.vue";
import ModelRow from "./ModelRow.vue";

const props = defineProps<{
  family: string;
  models: ModelSchema[];
  providerId: string;
}>();

const providerStore = useProviderStore();
const isExpanded = ref(true);

function deleteFamily() {
  providerStore.deleteModelsByFamily(props.providerId, props.family);
}
</script>
