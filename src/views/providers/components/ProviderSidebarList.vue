<template>
  <div class="w-64 h-full border-r border-border bg-card/40 flex flex-col flex-shrink-0 select-none">
    <!-- Header: Search & Add Provider -->
    <div class="p-3 border-b border-border/60 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          提供商 ({{ providerStore.filteredProviders.length }})
        </h2>
        <Button
          size="sm"
          variant="primary"
          class="h-6 px-2 text-xs gap-1"
          @click="drawerStore.openProviderDrawer('provider-add')"
        >
          <!-- Plus SVG -->
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span>新建</span>
        </Button>
      </div>

      <!-- Search Input -->
      <div class="relative w-full">
        <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-muted-foreground">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          v-model="providerStore.searchQuery"
          type="text"
          placeholder="搜索提供商..."
          class="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
        />
      </div>
    </div>

    <!-- Provider List (一行展示：仅标题和 API 类型) -->
    <AppleScrollArea class="flex-1 p-2">
      <div class="flex flex-col gap-1">
        <div
          v-for="provider in providerStore.filteredProviders"
          :key="provider.id"
          class="group/item relative px-2.5 py-2 rounded-xl border transition-all duration-150 cursor-pointer text-left flex items-center justify-between gap-2"
          :class="[
            providerStore.activeProviderId === provider.id
              ? 'bg-primary/10 border-primary/40 shadow-sm shadow-primary/10'
              : 'bg-card/60 hover:bg-accent/60 border-transparent hover:border-border/60',
          ]"
          @click="providerStore.setActiveProvider(provider.id)"
        >
          <!-- Left: Status dot + Title -->
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span
              class="w-2 h-2 rounded-full flex-shrink-0"
              :class="[
                provider.enabled !== false ? 'bg-emerald-500' : 'bg-slate-400',
              ]"
            />
            <span class="font-medium text-xs text-foreground truncate">
              {{ provider.name || provider.id }}
            </span>
          </div>

          <!-- Right: API Type Badge & Hover Actions -->
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <!-- Quick Actions on hover -->
            <div class="hidden group-hover/item:flex items-center gap-1">
              <button
                type="button"
                title="编辑提供商"
                class="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                @click.stop="drawerStore.openProviderDrawer('provider-edit', provider)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                type="button"
                title="删除提供商"
                class="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                @click.stop="confirmDelete(provider.id)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <!-- Protocol Badge -->
            <Badge size="sm" variant="secondary" class="text-[10px] px-1.5 py-0">
              {{ formatProtocol(provider.api) }}
            </Badge>
          </div>
        </div>
      </div>
    </AppleScrollArea>
  </div>
</template>

<script setup lang="ts">
import { useProviderStore } from "../../../stores/provider.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import Button from "../../../components/ui/Button.vue";
import Badge from "../../../components/ui/Badge.vue";
import AppleScrollArea from "../../../components/ui/AppleScrollArea.vue";
import type { ApiProtocol } from "../../../types/index.js";

const providerStore = useProviderStore();
const drawerStore = useDrawerStore();

function formatProtocol(api?: ApiProtocol) {
  if (!api) return "OpenAI";
  if (api.includes("anthropic")) return "Anthropic";
  if (api.includes("mistral")) return "Mistral";
  if (api.includes("google")) return "Google";
  if (api.includes("responses")) return "Responses";
  return "OpenAI";
}

function confirmDelete(id: string) {
  if (confirm(`确定要删除提供商 '${id}' 及其所有模型吗？`)) {
    providerStore.deleteProvider(id);
  }
}
</script>
