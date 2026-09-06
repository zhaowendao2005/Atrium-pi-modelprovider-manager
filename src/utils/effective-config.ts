import type {
  ModelSchema,
  ProviderSchema,
  ProviderCompatibilityConfig,
  ApiProtocol,
  ModelInputType,
  ModelCostConfig,
  ThinkingLevel,
} from "../types/index.js";

export interface EffectiveItemSource<T> {
  value: T;
  source: "model-override" | "provider-inherited" | "default-fallback";
  sourceName?: string;
}

export interface EffectiveCompatItem {
  key: keyof ProviderCompatibilityConfig;
  label: string;
  category: "patches" | "thinking" | "tokens" | "roles" | "caching" | "tools" | "network";
  value: boolean | string | Record<string, unknown> | undefined;
  rawMode: "inherit" | "custom" | "explicit";
  source: "model-override" | "provider-inherited" | "default-fallback";
  sourceDescription: string;
}

export interface EffectiveModelConfig {
  id: string;
  name: string;
  family: string;
  providerId: string;
  providerName: string;
  
  // 核心通信配置与来源
  api: EffectiveItemSource<ApiProtocol>;
  baseUrl: EffectiveItemSource<string>;
  authHeader: EffectiveItemSource<boolean>;
  
  // 模态与限制
  input: EffectiveItemSource<ModelInputType[]>;
  contextWindow: EffectiveItemSource<number>;
  maxTokens: EffectiveItemSource<number>;
  
  // 推理与计费
  reasoning: EffectiveItemSource<boolean>;
  thinkingLevelMap: EffectiveItemSource<Partial<Record<ThinkingLevel, string | null>>>;
  cost: EffectiveItemSource<ModelCostConfig>;
  
  // 参数与请求头
  headers: {
    merged: Record<string, string>;
    fromProvider: Record<string, string>;
    fromModel: Record<string, string>;
  };
  samplingParams: EffectiveItemSource<Record<string, unknown>>;
  
  // 兼容性适配全景
  compatList: EffectiveCompatItem[];
  compatRaw: ProviderCompatibilityConfig;
  
  // 预设追溯文案
  presetOrigin: {
    hasPreset: boolean;
    presetId?: string;
    presetName?: string;
    isModified: boolean;
    badgeText: string;
    description: string;
  };
  
  // 最终提交给 Pi 运行时的原始注册对象
  rawRuntimeRegistration: Record<string, unknown>;
}

export const PI_KERNEL_COMPAT_DEFAULTS: Record<string, boolean> = {
  supportsFinishReason: true,
  supportsUsageInStreaming: true,
  supportsDeveloperRole: true,
  supportsReasoningEffort: true,
  supportsEagerToolInputStreaming: true,
  supportsLongCacheRetention: true,
  supportsCacheControlOnTools: true,
  supportsTemperature: true,
  supportsStrictMode: true,
  forceAdaptiveThinking: false,
  allowEmptySignature: false,
  omitResponsesReasoningStatus: false,
  supportsExplicitPromptCacheMode: false,
  supportsAdditionalTools: false,
  supportsToolSearch: false,
  requiresToolResultName: false,
  requiresAssistantAfterToolResult: false,
  requiresReasoningContentOnAssistantMessages: false,
  requiresThinkingAsText: false,
  supportsStrictTools: false,
  supportsToolReferences: false,
  sendSessionAffinityHeaders: false,
};

export function getKernelCompatDefault(field: string): boolean {
  return PI_KERNEL_COMPAT_DEFAULTS[field] ?? false;
}

export function getInheritedCompatFallback(
  providerCompat: ProviderCompatibilityConfig | undefined,
  field: string
): boolean {
  if (providerCompat && (providerCompat as any)[field] !== undefined) {
    return Boolean((providerCompat as any)[field]);
  }
  return getKernelCompatDefault(field);
}

export function resolveEffectiveModelConfig(
  provider: ProviderSchema,
  model: ModelSchema
): EffectiveModelConfig {
  const providerName = provider.name || provider.id;
  const defaultApi: ApiProtocol = provider.api || "openai-completions";
  
  // 1. 基础通信参数计算
  const api: EffectiveItemSource<ApiProtocol> = model.api
    ? { value: model.api, source: "model-override", sourceName: "模型自身显式覆盖" }
    : { value: defaultApi, source: "provider-inherited", sourceName: `继承自提供商 [${providerName}]` };

  const baseUrl: EffectiveItemSource<string> = model.baseUrl && model.baseUrl.trim().length > 0
    ? { value: model.baseUrl.trim(), source: "model-override", sourceName: "模型独立端点覆盖" }
    : { value: provider.baseUrl, source: "provider-inherited", sourceName: `继承自提供商 [${providerName}] (${provider.baseUrl})` };

  const authHeader: EffectiveItemSource<boolean> = {
    value: provider.authHeader !== false,
    source: "provider-inherited",
    sourceName: `继承自提供商 [${providerName}]`,
  };

  // 2. 模态与限制计算
  const input: EffectiveItemSource<ModelInputType[]> = model.input && model.input.length > 0
    ? { value: model.input, source: "model-override", sourceName: "模型显式指定" }
    : { value: ["text"], source: "default-fallback", sourceName: "系统默认纯文本模态" };

  const contextWindow: EffectiveItemSource<number> = {
    value: model.contextWindow || 128000,
    source: model.contextWindow ? "model-override" : "default-fallback",
    sourceName: model.contextWindow ? "模型指定容量" : "系统默认 128K 容量",
  };

  const maxTokens: EffectiveItemSource<number> = {
    value: model.maxTokens || 16384,
    source: model.maxTokens ? "model-override" : "default-fallback",
    sourceName: model.maxTokens ? "模型指定单次限制" : "系统默认 16K 输出",
  };

  // 3. 推理与计费
  const reasoning: EffectiveItemSource<boolean> = {
    value: Boolean(model.reasoning),
    source: "model-override",
    sourceName: model.reasoning ? "模型已开启深度思考 (CoT)" : "普通对话模式",
  };

  const thinkingLevelMap: EffectiveItemSource<Partial<Record<ThinkingLevel, string | null>>> = {
    value: model.thinkingLevelMap || {},
    source: Object.keys(model.thinkingLevelMap || {}).length > 0 ? "model-override" : "default-fallback",
    sourceName: Object.keys(model.thinkingLevelMap || {}).length > 0 ? "已自定义 7 档映射" : "内置标准思考映射",
  };

  const cost: EffectiveItemSource<ModelCostConfig> = {
    value: model.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    source: model.cost ? "model-override" : "default-fallback",
    sourceName: "模型费率定义",
  };

  // 4. Headers 深度合并
  const pHeaders = provider.headers || {};
  const mHeaders = model.headers || {};
  const mergedHeaders: Record<string, string> = { ...pHeaders, ...mHeaders };

  // 5. 采样参数
  const samplingParams: EffectiveItemSource<Record<string, unknown>> = {
    value: model.samplingParams || {},
    source: Object.keys(model.samplingParams || {}).length > 0 ? "model-override" : "default-fallback",
    sourceName: Object.keys(model.samplingParams || {}).length > 0 ? "模型专属采样参数" : "无附加请求体参数",
  };

  // 6. 兼容性配置解析 (Model.compat 深度覆盖 Provider.compat)
  const pCompat = provider.compat || {};
  const mCompat = model.compat || {};
  const mergedCompat: ProviderCompatibilityConfig = { ...pCompat, ...mCompat };

  const compatList: EffectiveCompatItem[] = [];

  // 辅助构造 Compat 条目
  function addCompat(
    key: keyof ProviderCompatibilityConfig,
    label: string,
    category: EffectiveCompatItem["category"],
    defaultValue: unknown = undefined
  ) {
    const isModelSet = mCompat[key] !== undefined;
    const isProviderSet = pCompat[key] !== undefined;
    let finalVal = isModelSet ? mCompat[key] : (isProviderSet ? pCompat[key] : defaultValue);
    let source: EffectiveCompatItem["source"] = "default-fallback";
    let sourceDescription = defaultValue !== undefined ? `Pi 内核缺省 (${defaultValue ? "开启" : "关闭"})` : "未配置";
    let rawMode: EffectiveCompatItem["rawMode"] = "explicit";

    if (isModelSet) {
      source = "model-override";
      const valText = typeof mCompat[key] === "boolean" ? (mCompat[key] ? "开启" : "关闭") : String(mCompat[key]);
      sourceDescription = `模型显式覆盖 (${valText})`;
      rawMode = "custom";
    } else if (isProviderSet) {
      source = "provider-inherited";
      const valText = typeof pCompat[key] === "boolean" ? (pCompat[key] ? "开启" : "关闭") : String(pCompat[key]);
      sourceDescription = `继承自提供商 [${providerName}] (${valText})`;
      rawMode = "inherit";
    }

    compatList.push({
      key,
      label,
      category,
      value: finalVal as any,
      rawMode,
      source,
      sourceDescription,
    });
  }

  // 注入各 Compat 项
  addCompat("omitResponsesReasoningStatus", "过滤 Responses 思考状态 (omitResponsesReasoningStatus)", "patches", false);
  addCompat("thinkingFormat", "思考链传递格式 (thinkingFormat)", "thinking", undefined);
  addCompat("maxTokensField", "最大 Token 字段名 (maxTokensField)", "tokens", undefined);
  addCompat("thinkingTokenBudgetField", "思考预算字段 (thinkingTokenBudgetField)", "tokens", undefined);
  addCompat("supportsDeveloperRole", "支持 Developer 角色 (supportsDeveloperRole)", "roles", true);
  addCompat("supportsReasoningEffort", "Reasoning Effort 传递 (supportsReasoningEffort)", "thinking", true);
  addCompat("forceAdaptiveThinking", "自适应思考 (forceAdaptiveThinking)", "thinking", false);
  addCompat("allowEmptySignature", "允许空思考签名 (allowEmptySignature)", "thinking", false);
  addCompat("supportsExplicitPromptCacheMode", "显式提示词缓存 (supportsExplicitPromptCacheMode)", "caching", false);
  addCompat("supportsAdditionalTools", "扩展附加工具 (supportsAdditionalTools)", "tools", false);
  addCompat("supportsToolSearch", "内置工具搜索 (supportsToolSearch)", "tools", false);
  addCompat("requiresToolResultName", "工具必须含 Name (requiresToolResultName)", "tools", false);
  addCompat("requiresAssistantAfterToolResult", "工具后跟随 Assistant (requiresAssistantAfterToolResult)", "roles", false);
  addCompat("requiresReasoningContentOnAssistantMessages", "Assistant 含推理字段 (requiresReasoningContentOnAssistantMessages)", "thinking", false);
  addCompat("requiresThinkingAsText", "思考内容转文本 (requiresThinkingAsText)", "thinking", false);
  addCompat("supportsEagerToolInputStreaming", "工具即时流式解析 (supportsEagerToolInputStreaming)", "tools", true);
  addCompat("supportsLongCacheRetention", "1 小时长缓存 (supportsLongCacheRetention)", "caching", true);
  addCompat("supportsStrictTools", "严格模式 (supportsStrictTools)", "tools", false);
  addCompat("supportsToolReferences", "动态工具延迟引用 (supportsToolReferences)", "tools", false);
  addCompat("supportsUsageInStreaming", "流式包含 Token 统计 (supportsUsageInStreaming)", "network", true);
  addCompat("supportsFinishReason", "上游返回 finish_reason (supportsFinishReason)", "network", true);
  addCompat("sendSessionAffinityHeaders", "发送会话粘性头 (sendSessionAffinityHeaders)", "caching", false);

  // 7. 预设追溯文案推导
  const presetId = model.basePresetId || (model.appliedPreset && model.appliedPreset !== "custom" ? model.appliedPreset : undefined);
  const presetName = model.basePresetName || presetId;
  const isModified = Boolean(model.isModified || model.appliedPreset === "custom");

  let badgeText = "完全自定义配置 (Custom)";
  let presetDescription = "未套用任何官方预设模板，全部参数均为自定义手工配置。";

  if (presetId) {
    if (isModified) {
      badgeText = `基于 ${presetName} 个性化调整`;
      presetDescription = `该模型以官方「${presetName}」预设为基础，且已由用户进行了自定义参数覆盖与调整。`;
    } else {
      badgeText = `套用预设: ${presetName}`;
      presetDescription = `该模型完全套用官方「${presetName}」预设模板，所有参数与官方标准保持同步。`;
    }
  }

  // 8. 原始注册结构预览
  const rawRuntimeRegistration = {
    id: model.id,
    name: model.name || model.id,
    api: api.value,
    baseUrl: baseUrl.value,
    reasoning: reasoning.value,
    thinkingLevelMap: thinkingLevelMap.value,
    input: input.value,
    contextWindow: contextWindow.value,
    maxTokens: maxTokens.value,
    cost: cost.value,
    headers: mergedHeaders,
    samplingParams: samplingParams.value,
    compat: mergedCompat,
  };

  return {
    id: model.id,
    name: model.name || model.id,
    family: model.family || "Other",
    providerId: provider.id,
    providerName,
    api,
    baseUrl,
    authHeader,
    input,
    contextWindow,
    maxTokens,
    reasoning,
    thinkingLevelMap,
    cost,
    headers: {
      merged: mergedHeaders,
      fromProvider: pHeaders,
      fromModel: mHeaders,
    },
    samplingParams,
    compatList,
    compatRaw: mergedCompat,
    presetOrigin: {
      hasPreset: Boolean(presetId),
      presetId,
      presetName,
      isModified,
      badgeText,
      description: presetDescription,
    },
    rawRuntimeRegistration,
  };
}
