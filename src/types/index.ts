/**
 * 9 种 Pi 底层通信协议 (Wire Protocols)
 */
export type ApiProtocol =
  | "openai-completions"
  | "openai-responses"
  | "azure-openai-responses"
  | "openai-codex-responses"
  | "anthropic-messages"
  | "mistral-conversations"
  | "google-generative-ai"
  | "google-vertex"
  | "bedrock-converse-stream";

/**
 * Pi 7 档标准推理强度
 */
export type ThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/**
 * 支持的模态类型
 */
export type ModelInputType = "text" | "image";

/**
 * 模型计费阶梯
 */
export interface CostTier {
  inputTokensAbove: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * 模型费率配置 (单位: $/1M tokens)
 */
export interface ModelCostConfig {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  tiers?: CostTier[];
}

/**
 * 兼容性适配矩阵
 */
export interface ProviderCompatibilityConfig {
  // === OpenAI 兼容性 ===
  supportsStore?: boolean;
  supportsDeveloperRole?: boolean;
  supportsReasoningEffort?: boolean;
  supportsUsageInStreaming?: boolean;
  supportsFinishReason?: boolean;
  supportsStrictMode?: boolean;
  supportsOpenAIGrammarTools?: boolean;
  maxTokensField?: "max_completion_tokens" | "max_tokens";
  requiresToolResultName?: boolean;
  requiresAssistantAfterToolResult?: boolean;
  requiresThinkingAsText?: boolean;
  requiresReasoningContentOnAssistantMessages?: boolean;

  thinkingFormat?:
    | "openai"
    | "openrouter"
    | "deepseek"
    | "together"
    | "baseten"
    | "zai"
    | "qwen"
    | "chat-template"
    | "qwen-chat-template"
    | "string-thinking"
    | "ant-ling";

  chatTemplateKwargs?: Record<string, unknown>;
  chatTemplateArgs?: Record<string, unknown>;
  thinkingTokenBudgetField?: "thinking_token_budget" | "thinking_budget" | "thinking_budget_tokens";
  supportsThinkingTokenBudget?: boolean;
  cacheControlFormat?: "anthropic";
  sendSessionAffinityHeaders?: boolean;

  // === Anthropic 兼容性 ===
  supportsEagerToolInputStreaming?: boolean;
  supportsLongCacheRetention?: boolean;
  supportsCacheControlOnTools?: boolean;
  forceAdaptiveThinking?: boolean;
  allowEmptySignature?: boolean;
  supportsStrictTools?: boolean;
  supportsToolReferences?: boolean;
}

/**
 * 单个模型实体 Schema
 */
export interface ModelSchema {
  id: string;
  name?: string;
  family?: string; // 模型系列分组 (e.g. Claude, GPT, DeepSeek, Qwen, Gemini, Mistral, Llama, Other)
  api?: ApiProtocol;
  baseUrl?: string;
  reasoning?: boolean;
  thinkingLevelMap?: Partial<Record<ThinkingLevel, string | null>>;
  input?: ModelInputType[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: ModelCostConfig;
  samplingParams?: Record<string, unknown>;
  headers?: Record<string, string>;
  compat?: ProviderCompatibilityConfig;
}

/**
 * 提供商实体 Schema
 */
export interface ProviderSchema {
  id: string;
  name?: string;
  baseUrl: string;
  apiKey?: string;
  api?: ApiProtocol;
  authHeader?: boolean;
  headers?: Record<string, string>;
  models?: ModelSchema[];
  modelOverrides?: Record<string, Partial<ModelSchema>>;
  compat?: ProviderCompatibilityConfig;
  autoDiscover?: boolean;
  discoveryEndpoint?: string;
  enabled?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 全局设置 Schema
 */
export interface AppSettings {
  theme: "light" | "dark" | "auto";
  enableHeaderTrace: boolean;
  enableAutoOverflowRecovery: boolean;
  activeProviderId?: string;
  configStoragePath?: string;
}

/**
 * 持久化 YAML 根结构
 */
export interface AppConfigYaml {
  version: number;
  settings: AppSettings;
  providers: ProviderSchema[];
}
