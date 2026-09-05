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
   * 全局跨提供商智能模糊相似度匹配：即使当前提供商是自定义中转商/代理，也能自动匹配出官方模型预设
   */
  async function findGlobalBestMatchModel(modelId: string, preferredProviderId?: string): Promise<ModelSchema | null> {
    if (!modelId || !modelId.trim()) return null;

    // 1. 如果有首选提供商且能匹配到，优先匹配首选
    if (preferredProviderId) {
      const preferredMatch = await findBestMatchInProvider(preferredProviderId, modelId);
      if (preferredMatch) return preferredMatch;
    }

    // 2. 否则确保索引已加载
    await loadIndex();
    if (providerIndex.value.length === 0) return null;

    // 3. 检查常见的模型名前缀以直接缩小范围 (如 claude -> anthropic, gpt/o1/o3/o4 -> openai, gemini/gemma -> google, deepseek -> deepseek, qwen -> qwen-token-plan)
    const lower = modelId.toLowerCase();
    const candidateProviderIds: string[] = [];
    if (lower.includes("claude")) candidateProviderIds.push("anthropic", "amazon-bedrock", "google-vertex", "openrouter");
    if (lower.includes("gpt") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("o4")) candidateProviderIds.push("openai", "azure-openai-responses", "openrouter");
    if (lower.includes("gemini") || lower.includes("gemma")) candidateProviderIds.push("google", "google-vertex", "openrouter");
    if (lower.includes("deepseek")) candidateProviderIds.push("deepseek", "together", "fireworks", "openrouter");
    if (lower.includes("qwen")) candidateProviderIds.push("qwen-token-plan", "together", "openrouter");

    for (const pid of candidateProviderIds) {
      const match = await findBestMatchInProvider(pid, modelId);
      if (match) return match;
    }

    // 4. 若仍未匹配，在所有已知官方提供商的已缓存或前 5 个主要厂商中匹配
    const priorityProviders = ["openai", "anthropic", "google", "deepseek", "openrouter", "mistral", "xai"];
    for (const pid of priorityProviders) {
      if (!candidateProviderIds.includes(pid)) {
        const match = await findBestMatchInProvider(pid, modelId);
        if (match) return match;
      }
    }

    return null;
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
    target.basePresetId = preset.id;
    target.basePresetName = preset.name || preset.id;
    target.isModified = false;
  }

  /**
   * 宏操作：将模型预设参数批量填充到目标 Model 中（全字段解封、完全可编辑）
   * 遵循规范：切换模版绝不影响唯一标识 (id) 与用户已填写的显示名称 (name)
   */
  function applyModelPreset(
    target: ModelSchema,
    presetModel: ModelSchema,
    options: { preserveIdentityAndName?: boolean } = { preserveIdentityAndName: true }
  ): void {
    if (!target || !presetModel) return;

    // 绝不覆盖唯一标识 id；仅在 target.name 原本未填写且未强制保护时才补充 name
    if (!options.preserveIdentityAndName) {
      if (presetModel.name) target.name = presetModel.name;
    } else if (!target.name && presetModel.name) {
      target.name = presetModel.name;
    }

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
    target.basePresetId = presetModel.basePresetId || presetModel.id;
    target.basePresetName = presetModel.basePresetName || presetModel.name || presetModel.id;
    target.isModified = false;
  }

  return {
    isIndexLoaded,
    providerIndex,
    providerCache,
    isLoadingPreset,
    loadIndex,
    getProviderPreset,
    findBestMatchInProvider,
    findGlobalBestMatchModel,
    applyProviderPreset,
    applyModelPreset,
  };
});
