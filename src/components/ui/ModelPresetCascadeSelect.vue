<template>
  <div ref="containerRef" class="relative inline-block w-full">
    <!-- Trigger Button -->
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-xl border transition-all duration-150 text-left bg-background/80 hover:bg-muted/60 border-input shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
      :class="isOpen ? 'border-primary/50 ring-1 ring-primary/30' : ''"
      @click="toggleMenu"
    >
      <div class="flex items-center gap-2 min-w-0 truncate">
        <!-- Sparkles Icon (No Emoji) -->
        <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span v-if="selectedModelLabel" class="truncate font-medium text-foreground">
          {{ selectedModelLabel }}
        </span>
        <span v-else class="text-muted-foreground truncate">
          从官方预设库挑选套用 (先选提供商再选模型)...
        </span>
      </div>

      <!-- Chevron Down -->
      <svg
        class="w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200"
        :class="isOpen ? 'rotate-180 text-foreground' : ''"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Context Popover Menu (Cascading) -->
    <div
      v-if="isOpen"
      class="absolute left-0 top-full mt-1.5 z-50 flex rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-150 animate-fadeIn"
      :style="{ minWidth: '460px', height: '360px' }"
    >
      <!-- Level 1: Providers List & Search -->
      <div class="w-[200px] flex flex-col border-r border-border/60 bg-muted/20 shrink-0">
        <!-- Search Input -->
        <div class="p-2 border-b border-border/50">
          <div class="relative flex items-center">
            <svg class="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="providerSearchQuery"
              type="text"
              placeholder="搜索提供商..."
              class="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg bg-background border border-input focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        <!-- Provider Items (Apple Scroll Area) -->
        <AppleScrollArea class="flex-1">
          <div class="p-1.5 flex flex-col gap-0.5">
            <div
              v-if="filteredProviders.length === 0"
              class="py-8 text-center text-xs text-muted-foreground"
            >
              无匹配提供商
            </div>

            <button
              v-for="p in filteredProviders"
              :key="p.id"
              type="button"
              class="w-full flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl text-xs transition-colors duration-150 text-left group"
              :class="[
                activeProviderId === p.id
                  ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                  : 'text-foreground hover:bg-muted/80'
              ]"
              @mouseenter="onHoverProvider(p.id)"
              @click="onSelectProvider(p.id)"
            >
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="truncate">{{ p.name }}</span>
                  <span
                    v-if="isCurrentParentProvider(p.id)"
                    class="px-1 py-0.2 text-[9px] rounded-md shrink-0"
                    :class="activeProviderId === p.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-medium'"
                  >
                    当前
                  </span>
                </div>
                <span
                  class="text-[10px] truncate"
                  :class="activeProviderId === p.id ? 'text-primary-foreground/80' : 'text-muted-foreground'"
                >
                  {{ p.modelCount }} 个模型
                </span>
              </div>

              <!-- Chevron Right -->
              <svg
                class="w-3.5 h-3.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                :class="activeProviderId === p.id ? 'text-primary-foreground' : 'text-muted-foreground'"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </AppleScrollArea>
      </div>

      <!-- Level 2: Models List for Selected Provider -->
      <div class="flex-1 flex flex-col bg-background/50">
        <!-- Sub Header -->
        <div class="px-3.5 py-2 border-b border-border/50 flex items-center justify-between bg-muted/10">
          <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground truncate">
            <span>{{ activeProviderDetails?.name || activeProviderId || "选择模型预设" }}</span>
            <span v-if="activeProviderDetails?.models" class="text-[10px] text-muted-foreground font-normal">
              ({{ activeProviderDetails.models.length }} 个)
            </span>
          </div>
          <span v-if="isLoadingModels" class="text-[10px] text-muted-foreground animate-pulse">
            加载模型中...
          </span>
        </div>

        <!-- Models Scroll Area -->
        <AppleScrollArea class="flex-1">
          <div class="p-2 flex flex-col gap-1">
            <div
              v-if="!activeProviderId"
              class="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2"
            >
              <svg class="w-6 h-6 opacity-40 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>请从左侧悬停或点击选择提供商</span>
            </div>

            <div
              v-else-if="isLoadingModels"
              class="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2"
            >
              <span class="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span>正在获取该提供商的模型预设库...</span>
            </div>

            <div
              v-else-if="!activeProviderDetails || !activeProviderDetails.models || activeProviderDetails.models.length === 0"
              class="py-16 text-center text-xs text-muted-foreground"
            >
              该提供商暂无内置模型预设
            </div>

            <!-- Model Options -->
            <button
              v-for="m in activeProviderDetails?.models || []"
              :key="m.id"
              type="button"
              class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs transition-all duration-150 text-left hover:bg-purple-500/10 hover:border-purple-500/20 border border-transparent group"
              :class="isSelectedModel(m.id) ? 'bg-purple-500/15 border-purple-500/30' : ''"
              @click="onPickModel(m)"
            >
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-foreground truncate group-hover:text-purple-600 dark:group-hover:text-purple-400">
                    {{ m.name || m.id }}
                  </span>
                  <!-- Reasoning Badge -->
                  <span
                    v-if="m.reasoning"
                    class="px-1.5 py-0.2 text-[9px] rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium shrink-0"
                  >
                    思考
                  </span>
                </div>
                <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 truncate font-mono">
                  <span>{{ m.id }}</span>
                </div>
              </div>

              <!-- Context Window & MaxTokens Meta -->
              <div class="flex flex-col items-end shrink-0 text-[10px] text-muted-foreground">
                <span class="font-medium text-foreground/80">
                  {{ (m.contextWindow || 128000) / 1000 }}K 窗口
                </span>
                <span>
                  {{ (m.maxTokens || 16384) / 1000 }}K 输出
                </span>
              </div>
            </button>
          </div>
        </AppleScrollArea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { ModelSchema, ProviderPresetDetails } from "../../types/index.js";
import { usePresetsStore } from "../../stores/presets.js";
import AppleScrollArea from "./AppleScrollArea.vue";

const props = defineProps<{
  parentProviderId?: string;
  appliedPresetId?: string;
}>();

const emit = defineEmits<{
  (e: "select", model: ModelSchema, providerPreset: ProviderPresetDetails): void;
}>();

const presetsStore = usePresetsStore();

const containerRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const providerSearchQuery = ref("");
const activeProviderId = ref<string>("");
const isLoadingModels = ref(false);

const selectedModelLabel = computed(() => {
  if (!props.appliedPresetId || props.appliedPresetId === "custom") return "";
  return `已套用预设: ${props.appliedPresetId}`;
});

function isCurrentParentProvider(pid: string): boolean {
  if (!props.parentProviderId) return false;
  return pid.toLowerCase() === props.parentProviderId.toLowerCase();
}

function isSelectedModel(modelId: string): boolean {
  return props.appliedPresetId === modelId;
}

const filteredProviders = computed(() => {
  const query = providerSearchQuery.value.trim().toLowerCase();
  let list = presetsStore.providerIndex;

  if (query) {
    list = list.filter(
      (p) =>
        p.id.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query)
    );
  }

  // 排序：若命中当前所属提供商，置顶展示
  return [...list].sort((a, b) => {
    const aCurrent = isCurrentParentProvider(a.id);
    const bCurrent = isCurrentParentProvider(b.id);
    if (aCurrent && !bCurrent) return -1;
    if (!aCurrent && bCurrent) return 1;
    return 0;
  });
});

const activeProviderDetails = computed(() => {
  if (!activeProviderId.value) return null;
  return presetsStore.providerCache.get(activeProviderId.value.toLowerCase()) || null;
});

async function loadModelsForProvider(pid: string) {
  if (!pid) return;
  activeProviderId.value = pid;
  if (!presetsStore.providerCache.has(pid.toLowerCase())) {
    isLoadingModels.value = true;
    try {
      await presetsStore.getProviderPreset(pid);
    } finally {
      isLoadingModels.value = false;
    }
  }
}

function onHoverProvider(pid: string) {
  loadModelsForProvider(pid);
}

function onSelectProvider(pid: string) {
  loadModelsForProvider(pid);
}

function onPickModel(model: ModelSchema) {
  const details = activeProviderDetails.value;
  if (details) {
    emit("select", model, details);
  }
  isOpen.value = false;
}

function toggleMenu() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    presetsStore.loadIndex();
    if (props.parentProviderId) {
      const match = presetsStore.providerIndex.find((p) =>
        p.id.toLowerCase() === props.parentProviderId?.toLowerCase()
      );
      if (match) {
        loadModelsForProvider(match.id);
        return;
      }
    }
    if (presetsStore.providerIndex.length > 0) {
      loadModelsForProvider(presetsStore.providerIndex[0].id);
    }
  }
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener("click", handleClickOutside);
});
</script>
