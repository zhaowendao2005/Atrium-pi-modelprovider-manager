<template>
  <div class="ios-card group relative p-4 rounded-2xl bg-card/70 dark:bg-card/40 border border-border/80 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all flex flex-col justify-between select-none">
    <div>
      <!-- Header: Name, Family, Actions -->
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h4 class="font-semibold text-sm text-foreground truncate">
            {{ props.model.name || props.model.id }}
          </h4>
          <p class="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
            {{ props.model.id }}
          </p>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <!-- Edit -->
          <button
            type="button"
            title="编辑模型"
            class="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
            @click="editModel"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <!-- Delete -->
          <button
            type="button"
            title="删除模型"
            class="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            @click="deleteModel"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Capability Badges (Pure SVGs) -->
      <div class="flex flex-wrap items-center gap-1.5 mt-3">
        <!-- Reasoning / Thinking Badge -->
        <Badge v-if="props.model.reasoning" size="sm" variant="purple">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>推理思考</span>
        </Badge>

        <!-- Vision / Image Badge -->
        <Badge v-if="props.model.input?.includes('image')" size="sm" variant="default">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>视觉识别</span>
        </Badge>

        <!-- Text Only Badge -->
        <Badge v-else size="sm" variant="secondary">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>纯文本</span>
        </Badge>

        <!-- Context Window Badge -->
        <Badge size="sm" variant="outline">
          <span>{{ formatTokens(props.model.contextWindow || 128000) }} ctx</span>
        </Badge>
      </div>
    </div>

    <!-- Footer: Limits & Cost -->
    <div class="mt-4 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
      <span>Max: {{ formatTokens(props.model.maxTokens || 16384) }}</span>
      <div v-if="props.model.cost" class="flex items-center gap-1 font-mono">
        <span>${{ props.model.cost.input }}/M in</span>
        <span>·</span>
        <span>${{ props.model.cost.output }}/M out</span>
      </div>
      <span v-else class="text-muted-foreground/60">免费 / 默认</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import Badge from "../../../components/ui/Badge.vue";
import type { ModelSchema } from "../../../types/index.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import { useProviderStore } from "../../../stores/provider.js";

const props = defineProps<{
  model: ModelSchema;
  providerId: string;
}>();

const drawerStore = useDrawerStore();
const providerStore = useProviderStore();

function formatTokens(tokens: number) {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
  return `${tokens}`;
}

function editModel() {
  drawerStore.openModelDrawer("model-edit", props.providerId, props.model);
}

function deleteModel() {
  if (confirm(`确定要移除模型 '${props.model.id}' 吗？`)) {
    providerStore.deleteModel(props.providerId, props.model.id);
  }
}
</script>
