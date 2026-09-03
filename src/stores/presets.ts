import { defineStore } from "pinia";
import { ref } from "vue";
import type { ProviderPresetSummary, ProviderPresetDetails, ModelSchema, ProviderSchema } from "../types/index.js";
import { fetchPresetIndex, fetchProviderPreset } from "../utils/sqlite-storage.js";

export const usePresetsStore = defineStore("presets", () => {
  const isIndexLoaded = ref(false);
  const providerIndex = ref<ProviderPresetSummary[]>([]);
  const providerCache = ref<Map<string, ProviderPresetDetails>>(new Map());
  const isLoadingPreset = ref(false);

  /**
   * 渐进式 Level 0: 仅加载轻量提供商索引列表 (~2KB)
   */
  async function loadIndex(): Promise<void> {
    if (isIndexLoaded.value && providerIndex.value.length > 0) return;
    try {
      const list = await fetchPresetIndex();
      providerIndex.value = list;
      isIndexLoaded.value = true;
    } catch (err) {
      console.warn("[presetsStore] Failed to load preset index:", err);
    }
  }

  /**
   * 渐进式 Level 1: 按需加载某个特定 Provider 的预设模型详情
   */
  async function getProviderPreset(providerId: string): Promise<ProviderPresetDetails | null> {
    const normalizedId = providerId.toLowerCase().trim();
    if (providerCache.value.has(normalizedId)) {
      return providerCache.value.get(normalizedId)!;
    }

    isLoadingPreset.value = true;
    try {
      const details = await fetchProviderPreset(normalizedId);
      if (details) {
        providerCache.value.set(normalizedId, details);
        return details;
      }
    } catch (err) {
      console.warn(`[presetsStore] Failed to fetch preset for ${providerId}:`, err);
    } finally {
      isLoadingPreset.value = false;
    }
    return null;
  }

  /**
   * 在当前提供商作用域内，执行高效模糊相似度匹配，寻找最相近的官方预设模型
   */
  async function findBestMatchInProvider(providerId: string, modelId: string): Promise<ModelSchema | null> {
    if (!modelId || !modelId.trim()) return null;
    const details = await getProviderPreset(providerId);
    if (!details || !details.models || details.models.length === 0) return null;

    const target = modelId.toLowerCase().trim();

    // 1. 精确匹配
    const exact = details.models.find((m) => m.id.toLowerCase() === target);
    if (exact) return exact;

    // 2. 包含匹配或常见型号变体匹配
    let bestMatch: ModelSchema | null = null;
    let highestScore = 0;

    for (const m of details.models) {
      const mid = m.id.toLowerCase();
      let score = 0;

      if (mid === target) {
        score = 100;
      } else if (target.includes(mid) || mid.includes(target)) {
        score = 70 + Math.min(mid.length, target.length);
      } else {
        // 计算公共单词重合度
        const targetTokens = target.split(/[-_./:]+/);
        const midTokens = mid.split(/[-_./:]+/);
        let matchCount = 0;
        for (const t of targetTokens) {
          if (t.length > 1 && midTokens.includes(t)) {
            matchCount++;
          }
        }
        if (matchCount > 0) {
          score = (matchCount / Math.max(targetTokens.length, midTokens.length)) * 60;
        }
      }

      if (score > highestScore && score >= 40) {
        highestScore = score;
        bestMatch = m;
      }
    }

    return bestMatch;
  }

  /**
   * 宏操作：将提供商预设参数批量覆盖填充到目标 Provider 中
   */
  function applyProviderPreset(target: ProviderSchema, preset: ProviderPresetDetails): void {
    if (!target || !preset) return;
    target.name = preset.name || target.name;
    if (preset.baseUrl) target.baseUrl = preset.baseUrl;
    if (preset.defaultApi) target.api = preset.defaultApi;
    target.compat = preset.compat ? JSON.parse(JSON.stringify(preset.compat)) : {};
    target.appliedPreset = preset.id;
  }

  /**
   * 宏操作：将模型预设参数批量填充到目标 Model 中（全字段解封、完全可编辑）
   */
  function applyModelPreset(target: ModelSchema, presetModel: ModelSchema): void {
    if (!target || !presetModel) return;
    if (presetModel.name) target.name = presetModel.name;
    if (presetModel.family) target.family = presetModel.family;
    if (presetModel.reasoning !== undefined) target.reasoning = presetModel.reasoning;
    if (presetModel.input) target.input = [...presetModel.input];
    if (presetModel.contextWindow) target.contextWindow = presetModel.contextWindow;
    if (presetModel.maxTokens) target.maxTokens = presetModel.maxTokens;

    target.cost = presetModel.cost
      ? JSON.parse(JSON.stringify(presetModel.cost))
      : { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    target.thinkingLevelMap = presetModel.thinkingLevelMap
      ? JSON.parse(JSON.stringify(presetModel.thinkingLevelMap))
      : undefined;
    target.compat = presetModel.compat
      ? JSON.parse(JSON.stringify(presetModel.compat))
      : undefined;
    target.appliedPreset = presetModel.id;
  }

  return {
    isIndexLoaded,
    providerIndex,
    providerCache,
    isLoadingPreset,
    loadIndex,
    getProviderPreset,
    findBestMatchInProvider,
    applyProviderPreset,
    applyModelPreset,
  };
});
