<template>
  <div class="border border-border/80 rounded-2xl overflow-hidden bg-card/60 transition-all shadow-sm">
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

        <span class="font-semibold text-xs text-foreground tracking-tight">
          {{ props.family }}
        </span>

        <span class="text-[11px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-mono">
          {{ props.models.length }}
        </span>
      </div>
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
import ModelRow from "./ModelRow.vue";

const props = defineProps<{
  family: string;
  models: ModelSchema[];
  providerId: string;
}>();

const isExpanded = ref(true);
</script>
