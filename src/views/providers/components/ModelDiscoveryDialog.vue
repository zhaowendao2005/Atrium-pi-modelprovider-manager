<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="props.modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm"
        @click.self="close"
      >
        <div
          class="relative w-full max-w-5xl h-[90vh] max-h-[850px] bg-card/95 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
        >
          <!-- 1. Header -->
          <div class="px-6 py-4 border-b border-border/80 bg-card/60 backdrop-blur-md flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                <!-- Cloud Download / Discovery SVG Icon -->
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-semibold text-foreground tracking-tight">
                    从远端发现并选择添加模型
                  </h3>
                  <Badge variant="secondary" size="sm" class="font-mono">
                    共 {{ props.rawModels.length }} 个模型
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">
                  提供商: <span class="font-medium text-foreground">{{ props.providerName }}</span> · 端点: <span class="font-mono text-muted-foreground/80">{{ props.fetchUrl }}</span>
                </p>
              </div>
            </div>

            <!-- Close Button -->
            <button
              type="button"
              class="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="关闭 (Esc)"
              @click="close"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 2. Toolbar (Search, Filter, Quick Actions) -->
          <div class="px-6 py-3 border-b border-border/60 bg-muted/20 flex flex-col gap-3 flex-shrink-0">
            <!-- Search & Actions Row -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <!-- Search Bar -->
              <div class="relative flex-1 max-w-md">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索模型 ID 或关键字..."
                  class="w-full pl-9 pr-8 py-1.5 text-xs bg-background/80 border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
                <button
                  v-if="searchQuery"
                  type="button"
                  class="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted-foreground hover:text-foreground"
                  @click="searchQuery = ''"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Quick Selection Controls -->
              <div class="flex items-center gap-2 flex-wrap text-xs">
                <!-- Only Unadded Filter -->
                <label class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/60 border border-border/70 text-muted-foreground hover:text-foreground cursor-pointer select-none transition-colors">
                  <input
                    v-model="onlyShowUnadded"
                    type="checkbox"
                    class="rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span>仅看未添加</span>
                </label>

                <div class="h-4 w-[1px] bg-border/80 mx-1 hidden sm:block" />

                <!-- Select All Filtered -->
                <button
                  type="button"
                  class="h-7 w-7 flex-shrink-0 inline-flex items-center justify-center rounded-lg border border-border/80 bg-background/80 hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100"
                  :disabled="allSelectableFilteredIds.length === 0"
                  title="全选当前"
                  aria-label="全选当前"
                  @click="selectAllFiltered"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 7 17l-5-5" />
                    <path d="m22 10-7.5 7.5L13 16" />
                  </svg>
                </button>

                <!-- Deselect All -->
                <button
                  type="button"
                  class="h-7 w-7 flex-shrink-0 inline-flex items-center justify-center rounded-lg border border-border/80 bg-background/80 hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100"
                  :disabled="selectedModelIds.size === 0"
                  title="清空已选"
                  aria-label="清空已选"
                  @click="deselectAll"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m15 9-6 6" />
                    <path d="m9 9 6 6" />
                  </svg>
                </button>

                <!-- Toggle All Expand/Collapse -->
                <button
                  type="button"
                  class="h-7 w-7 flex-shrink-0 inline-flex items-center justify-center rounded-lg border border-border/80 bg-background/80 hover:bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100"
                  :title="areAllExpanded ? '折叠全部' : '展开全部'"
                  :aria-label="areAllExpanded ? '折叠全部' : '展开全部'"
                  @click="toggleExpandAll"
                >
                  <svg v-if="areAllExpanded" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m17 11-5-5-5 5" />
                    <path d="m17 18-5-5-5 5" />
                  </svg>
                  <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m7 13 5 5 5-5" />
                    <path d="m7 6 5 5 5-5" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Family Pills Filter Row -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 select-none no-scrollbar">
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                :class="[
                  selectedFamilyFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-background/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60',
                ]"
                @click="selectedFamilyFilter = 'all'"
              >
                全部系列 ({{ totalRawCount }})
              </button>

              <button
                v-for="grp in rawFamilyStats"
                :key="grp.name"
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0 flex items-center gap-1.5"
                :class="[
                  selectedFamilyFilter === grp.name
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-background/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60',
                ]"
                @click="selectedFamilyFilter = grp.name"
              >
                <span>{{ grp.name }}</span>
                <span
                  class="px-1.5 py-0.2 rounded-full text-[10px] font-mono"
                  :class="[
                    selectedFamilyFilter === grp.name
                      ? 'bg-white/20 text-white'
                      : 'bg-muted text-muted-foreground',
                  ]"
                >
                  {{ grp.count }}
                </span>
              </button>
            </div>
          </div>

          <!-- 3. Scrollable List of Model Families -->
          <AppleScrollArea class="flex-1 px-6 py-4">
            <!-- Empty state when searching has no result -->
            <div
              v-if="displayedFamilyGroups.length === 0"
              class="h-64 flex flex-col items-center justify-center text-center text-muted-foreground"
            >
              <div class="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-2 text-muted-foreground/60">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p class="text-sm font-semibold text-foreground">未找到匹配的模型</p>
              <p class="text-xs text-muted-foreground mt-0.5">
                请尝试更换关键词，或者取消「仅看未添加」筛选条件。
              </p>
            </div>

            <!-- Family Groups Accordion / Cards -->
            <div v-else class="flex flex-col gap-3.5">
              <div
                v-for="grp in displayedFamilyGroups"
                :key="grp.name"
                class="border border-border/80 rounded-2xl overflow-hidden bg-card/60 transition-all shadow-xs"
              >
                <!-- Family Header (Click checkbox to select entire series; click row to expand/collapse) -->
                <div class="px-4 py-3 bg-muted/40 hover:bg-muted/60 flex items-center justify-between transition-colors select-none">
                  <!-- Left: Checkbox (Select Whole Family) + Family Name + Count Badge -->
                  <div class="flex items-center gap-3 min-w-0">
                    <!-- Family Level Checkbox -->
                    <div
                      class="relative flex items-center justify-center cursor-pointer"
                      :title="grp.selectableCount === 0 ? '该系列所有模型均已挂载' : grp.isAllSelected ? '取消选择整系列' : '选择添加整系列'"
                      @click.stop="toggleFamilySelection(grp)"
                    >
                      <div
                        class="w-4 h-4 rounded-md border flex items-center justify-center transition-colors"
                        :class="[
                          grp.selectableCount === 0
                            ? 'border-border/60 bg-muted/40 cursor-not-allowed opacity-50'
                            : grp.isAllSelected || grp.isIndeterminate
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border/90 bg-background hover:border-primary/60 cursor-pointer',
                        ]"
                      >
                        <!-- Checkmark if all selected -->
                        <svg
                          v-if="grp.isAllSelected && grp.selectableCount > 0"
                          class="w-3 h-3 text-current"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                        <!-- Horizontal dash if indeterminate -->
                        <svg
                          v-else-if="grp.isIndeterminate"
                          class="w-3 h-3 text-current"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 12h14" />
                        </svg>
                      </div>
                    </div>

                    <!-- Expand / Collapse Trigger -->
                    <div
                      class="flex items-center gap-2 cursor-pointer"
                      @click="toggleGroupExpand(grp.name)"
                    >
                      <!-- Chevron -->
                      <div
                        class="text-muted-foreground transition-transform duration-200"
                        :class="[expandedFamilies.has(grp.name) ? 'rotate-90' : 'rotate-0']"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>

                      <span class="font-semibold text-xs text-foreground tracking-tight">
                        {{ grp.name }}
                      </span>

                      <!-- Count Badges -->
                      <span class="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                        {{ grp.items.length }} 个模型
                      </span>

                      <!-- Selected within family indicator -->
                      <span
                        v-if="grp.selectedCount > 0"
                        class="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium"
                      >
                        已选 {{ grp.selectedCount }}
                      </span>
                    </div>
                  </div>

                  <!-- Right: Quick whole-series toggle button -->
                  <div class="flex items-center gap-2">
                    <button
                      v-if="grp.selectableCount > 0"
                      type="button"
                      class="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors px-2 py-0.5 rounded-md hover:bg-primary/10"
                      @click.stop="toggleFamilySelection(grp)"
                    >
                      {{ grp.isAllSelected ? '取消整系列' : '全选整系列' }}
                    </button>
                    <span v-else class="text-[11px] text-muted-foreground/60">
                      全系列已挂载
                    </span>
                  </div>
                </div>

                <!-- Family Models List -->
                <div v-show="expandedFamilies.has(grp.name)" class="flex flex-col divide-y divide-border/40">
                  <div
                    v-for="model in grp.items"
                    :key="model.id"
                    class="px-4 py-2.5 flex items-center justify-between transition-colors select-none group"
                    :class="[
                      model.isExisting
                        ? 'bg-muted/20 opacity-70 cursor-default'
                        : selectedModelIds.has(model.id)
                        ? 'bg-primary/5 hover:bg-primary/10 cursor-pointer'
                        : 'hover:bg-accent/40 cursor-pointer',
                    ]"
                    @click="handleRowClick(model)"
                  >
                    <!-- Left: Checkbox + Model Info -->
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <!-- Checkbox -->
                      <div
                        class="w-4 h-4 rounded-md border flex items-center justify-center transition-colors flex-shrink-0"
                        :class="[
                          model.isExisting
                            ? 'border-border/60 bg-muted/60 text-muted-foreground/50 cursor-not-allowed'
                            : selectedModelIds.has(model.id)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border bg-background group-hover:border-primary/60',
                        ]"
                      >
                        <!-- Checked Icon -->
                        <svg
                          v-if="selectedModelIds.has(model.id) || model.isExisting"
                          class="w-3 h-3 text-current"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>

                      <!-- Model ID & Name -->
                      <div class="flex items-baseline gap-2 min-w-0 flex-wrap">
                        <span
                          class="font-mono text-xs font-semibold tracking-tight truncate"
                          :class="[model.isExisting ? 'text-muted-foreground' : 'text-foreground']"
                        >
                          {{ model.id }}
                        </span>

                        <span
                          v-if="model.name && model.name !== model.id"
                          class="text-[11px] text-muted-foreground/80 truncate max-w-xs"
                        >
                          ({{ model.name }})
                        </span>
                      </div>
                    </div>

                    <!-- Right: Capability Badges & Status -->
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <!-- Already Added Badge -->
                      <span
                        v-if="model.isExisting"
                        class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/80"
                      >
                        已挂载
                      </span>

                      <!-- Reasoning Badge -->
                      <span
                        v-if="model.reasoning"
                        class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                        title="推测为深度推理模型 (含思考链 / CoT)"
                      >
                        深度推理
                      </span>

                      <!-- Vision Badge -->
                      <span
                        v-if="model.vision"
                        class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        title="推测支持视觉与图像多模态输入"
                      >
                        视觉
                      </span>

                      <!-- Embedding Badge -->
                      <span
                        v-if="model.embedding"
                        class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                        title="向量嵌入模型"
                      >
                        嵌入
                      </span>

                      <!-- Copy ID button -->
                      <button
                        type="button"
                        class="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 transition-colors"
                        title="复制模型 ID"
                        @click.stop="copyModelId(model.id)"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AppleScrollArea>

          <!-- 4. Footer (Summary and Action Buttons) -->
          <div class="px-6 py-4 border-t border-border/80 bg-card/60 backdrop-blur-md flex items-center justify-between flex-shrink-0">
            <!-- Left: Stats summary -->
            <div class="text-xs text-muted-foreground flex items-center gap-2">
              <span>
                已选择 <strong class="text-primary font-semibold">{{ selectedModelIds.size }}</strong> 个待添加模型
              </span>
              <span class="text-muted-foreground/40">|</span>
              <span>已挂载 {{ existingSet.size }} 个</span>
            </div>

            <!-- Right: Action buttons -->
            <div class="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                class="px-4 h-9 text-xs"
                @click="close"
              >
                取消
              </Button>

              <Button
                variant="primary"
                size="sm"
                class="px-5 h-9 text-xs gap-1.5 shadow-sm"
                :loading="isSubmitting"
                :disabled="selectedModelIds.size === 0"
                @click="confirmSelection"
              >
                <!-- Plus SVG Icon -->
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>确认添加 ({{ selectedModelIds.size }})</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { ModelSchema } from "../../../types/index.js";
import { guessModelFamily, guessModelCapabilities, MODEL_FAMILY_ORDER } from "../../../utils/model-family.js";
import AppleScrollArea from "../../../components/ui/AppleScrollArea.vue";
import Button from "../../../components/ui/Button.vue";
import Badge from "../../../components/ui/Badge.vue";

interface RawModelItem {
  id: string;
  name?: string;
  [key: string]: any;
}

interface Props {
  modelValue: boolean;
  providerId: string;
  providerName: string;
  fetchUrl: string;
  rawModels: RawModelItem[];
  existingModelIds: string[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
  (e: "confirm", selectedModelIds: string[]): void;
}>();

// State
const searchQuery = ref("");
const selectedFamilyFilter = ref("all");
const onlyShowUnadded = ref(false);
const selectedModelIds = ref<Set<string>>(new Set());
const expandedFamilies = ref<Set<string>>(new Set());
const isSubmitting = ref(false);

const existingSet = computed(() => new Set(props.existingModelIds));
const totalRawCount = computed(() => props.rawModels.length);

interface EnhancedModelItem {
  id: string;
  name: string;
  family: string;
  isExisting: boolean;
  reasoning: boolean;
  vision: boolean;
  embedding: boolean;
  contextWindow: number;
  maxTokens: number;
}

// Convert all raw models into structured items with guessed properties
const allEnhancedModels = computed<EnhancedModelItem[]>(() => {
  return props.rawModels.map((item) => {
    const family = guessModelFamily(item.id);
    const caps = guessModelCapabilities(item.id);
    const isExisting = existingSet.value.has(item.id);

    return {
      id: item.id,
      name: item.name || item.id,
      family,
      isExisting,
      reasoning: caps.reasoning,
      vision: caps.vision,
      embedding: caps.embedding,
      contextWindow: caps.contextWindow,
      maxTokens: caps.maxTokens,
    };
  });
});

// Family stats for filter pills
const rawFamilyStats = computed(() => {
  const map: Record<string, number> = {};
  for (const m of allEnhancedModels.value) {
    map[m.family] = (map[m.family] || 0) + 1;
  }

  return MODEL_FAMILY_ORDER.filter((f) => !!map[f]).map((name) => ({
    name,
    count: map[name],
  }));
});

interface FamilyGroup {
  name: string;
  items: EnhancedModelItem[];
  selectableCount: number;
  selectedCount: number;
  isAllSelected: boolean;
  isIndeterminate: boolean;
}

// Group models by family and apply search & filters
const displayedFamilyGroups = computed<FamilyGroup[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const filterFam = selectedFamilyFilter.value;
  const hideAdded = onlyShowUnadded.value;

  // Filter models
  const filtered = allEnhancedModels.value.filter((m) => {
    if (hideAdded && m.isExisting) return false;
    if (filterFam !== "all" && m.family !== filterFam) return false;
    if (q) {
      const matchId = m.id.toLowerCase().includes(q);
      const matchName = m.name.toLowerCase().includes(q);
      if (!matchId && !matchName) return false;
    }
    return true;
  });

  // Group by family
  const groupsMap: Record<string, EnhancedModelItem[]> = {};
  for (const m of filtered) {
    if (!groupsMap[m.family]) {
      groupsMap[m.family] = [];
    }
    groupsMap[m.family].push(m);
  }

  // Sort families according to MODEL_FAMILY_ORDER
  const groups: FamilyGroup[] = [];
  const knownFamilies = new Set(MODEL_FAMILY_ORDER);

  for (const fam of MODEL_FAMILY_ORDER) {
    if (groupsMap[fam] && groupsMap[fam].length > 0) {
      const items = groupsMap[fam];
      const selectable = items.filter((m) => !m.isExisting);
      const selected = selectable.filter((m) => selectedModelIds.value.has(m.id));

      groups.push({
        name: fam,
        items,
        selectableCount: selectable.length,
        selectedCount: selected.length,
        isAllSelected: selectable.length > 0 && selected.length === selectable.length,
        isIndeterminate: selected.length > 0 && selected.length < selectable.length,
      });
    }
  }

  // Any other families not in MODEL_FAMILY_ORDER
  for (const [fam, items] of Object.entries(groupsMap)) {
    if (!knownFamilies.has(fam) && items.length > 0) {
      const selectable = items.filter((m) => !m.isExisting);
      const selected = selectable.filter((m) => selectedModelIds.value.has(m.id));

      groups.push({
        name: fam,
        items,
        selectableCount: selectable.length,
        selectedCount: selected.length,
        isAllSelected: selectable.length > 0 && selected.length === selectable.length,
        isIndeterminate: selected.length > 0 && selected.length < selectable.length,
      });
    }
  }

  return groups;
});

// All selectable IDs under current filter view
const allSelectableFilteredIds = computed(() => {
  const ids: string[] = [];
  for (const grp of displayedFamilyGroups.value) {
    for (const item of grp.items) {
      if (!item.isExisting) {
        ids.push(item.id);
      }
    }
  }
  return ids;
});

const areAllExpanded = computed(() => {
  if (displayedFamilyGroups.value.length === 0) return false;
  return displayedFamilyGroups.value.every((g) => expandedFamilies.value.has(g.name));
});

// Watch dialog opening: initialize expanded families & clear old selection
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      selectedModelIds.value = new Set();
      searchQuery.value = "";
      selectedFamilyFilter.value = "all";
      onlyShowUnadded.value = false;
      // Default: expand all families for quick overview
      expandedFamilies.value = new Set(MODEL_FAMILY_ORDER);
    }
  },
  { immediate: true }
);

function close() {
  emit("update:modelValue", false);
}

function handleRowClick(model: EnhancedModelItem) {
  if (model.isExisting) return;
  const set = new Set(selectedModelIds.value);
  if (set.has(model.id)) {
    set.delete(model.id);
  } else {
    set.add(model.id);
  }
  selectedModelIds.value = set;
}

// Whole-Family Batch Toggle
function toggleFamilySelection(grp: FamilyGroup) {
  if (grp.selectableCount === 0) return;

  const set = new Set(selectedModelIds.value);
  if (grp.isAllSelected) {
    // Deselect all in this family
    for (const item of grp.items) {
      if (!item.isExisting) {
        set.delete(item.id);
      }
    }
  } else {
    // Select all in this family
    for (const item of grp.items) {
      if (!item.isExisting) {
        set.add(item.id);
      }
    }
  }
  selectedModelIds.value = set;
}

function toggleGroupExpand(name: string) {
  const set = new Set(expandedFamilies.value);
  if (set.has(name)) {
    set.delete(name);
  } else {
    set.add(name);
  }
  expandedFamilies.value = set;
}

function toggleExpandAll() {
  if (areAllExpanded.value) {
    expandedFamilies.value = new Set();
  } else {
    expandedFamilies.value = new Set(displayedFamilyGroups.value.map((g) => g.name));
  }
}

function selectAllFiltered() {
  const set = new Set(selectedModelIds.value);
  for (const id of allSelectableFilteredIds.value) {
    set.add(id);
  }
  selectedModelIds.value = set;
}

function deselectAll() {
  selectedModelIds.value = new Set();
}

async function copyModelId(id: string) {
  try {
    await navigator.clipboard.writeText(id);
  } catch (err) {
    console.warn("Failed to copy ID to clipboard", err);
  }
}

function confirmSelection() {
  if (selectedModelIds.value.size === 0) return;
  emit("confirm", Array.from(selectedModelIds.value));
}
</script>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

/* Hide scrollbar for pills */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
