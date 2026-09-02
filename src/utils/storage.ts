import * as YAML from "yaml";
import type { AppConfigYaml, ProviderSchema, AppSettings } from "../types/index.js";

export const DEFAULT_STORAGE_DIR = "~/.pi/pi-modelprovider-manager-data";
export const CONFIG_FILE_NAME = "config.yaml";

export const INITIAL_CONFIG: AppConfigYaml = {
  version: 1,
  settings: {
    theme: "auto",
    enableHeaderTrace: true,
    enableAutoOverflowRecovery: true,
    activeProviderId: "anthropic-hub",
    configStoragePath: "~/.pi/pi-modelprovider-manager-data/config.yaml",
  },
  providers: [
    {
      id: "anthropic-hub",
      name: "Anthropic Gateway",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "$ANTHROPIC_API_KEY",
      api: "anthropic-messages",
      authHeader: false,
      enabled: true,
      autoDiscover: false,
      compat: {
        forceAdaptiveThinking: true,
        supportsEagerToolInputStreaming: true,
      },
      models: [
        {
          id: "claude-3-7-sonnet-20250219",
          name: "Claude 3.7 Sonnet",
          family: "Claude",
          reasoning: true,
          input: ["text", "image"],
          contextWindow: 200000,
          maxTokens: 16384,
          cost: {
            input: 3.0,
            output: 15.0,
            cacheRead: 0.3,
            cacheWrite: 3.75,
          },
          compat: {
            forceAdaptiveThinking: true,
          },
        },
        {
          id: "claude-3-5-sonnet-20241022",
          name: "Claude 3.5 Sonnet",
          family: "Claude",
          reasoning: false,
          input: ["text", "image"],
          contextWindow: 200000,
          maxTokens: 8192,
          cost: {
            input: 3.0,
            output: 15.0,
            cacheRead: 0.3,
            cacheWrite: 3.75,
          },
        },
        {
          id: "claude-3-5-haiku-20241022",
          name: "Claude 3.5 Haiku",
          family: "Claude",
          reasoning: false,
          input: ["text", "image"],
          contextWindow: 200000,
          maxTokens: 8192,
          cost: {
            input: 0.8,
            output: 4.0,
            cacheRead: 0.08,
            cacheWrite: 1.0,
          },
        },
      ],
    },
    {
      id: "openai-main",
      name: "OpenAI Direct",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "$OPENAI_API_KEY",
      api: "openai-completions",
      authHeader: true,
      enabled: true,
      autoDiscover: true,
      compat: {
        supportsUsageInStreaming: true,
        supportsDeveloperRole: true,
      },
      models: [
        {
          id: "gpt-4o",
          name: "GPT-4o",
          family: "GPT",
          reasoning: false,
          input: ["text", "image"],
          contextWindow: 128000,
          maxTokens: 16384,
          cost: {
            input: 2.5,
            output: 10.0,
            cacheRead: 1.25,
            cacheWrite: 2.5,
          },
        },
        {
          id: "o3-mini",
          name: "o3-mini",
          family: "GPT",
          reasoning: true,
          input: ["text"],
          contextWindow: 200000,
          maxTokens: 65536,
          cost: {
            input: 1.1,
            output: 4.4,
            cacheRead: 0.55,
            cacheWrite: 1.1,
          },
          compat: {
            thinkingFormat: "openai",
            supportsReasoningEffort: true,
          },
        },
        {
          id: "o1",
          name: "o1",
          family: "GPT",
          reasoning: true,
          input: ["text", "image"],
          contextWindow: 200000,
          maxTokens: 100000,
          cost: {
            input: 15.0,
            output: 60.0,
            cacheRead: 7.5,
            cacheWrite: 15.0,
          },
        },
      ],
    },
    {
      id: "deepseek-official",
      name: "DeepSeek Official",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "$DEEPSEEK_API_KEY",
      api: "openai-completions",
      authHeader: true,
      enabled: true,
      compat: {
        thinkingFormat: "deepseek",
        supportsUsageInStreaming: true,
        maxTokensField: "max_tokens",
      },
      models: [
        {
          id: "deepseek-reasoner",
          name: "DeepSeek R1",
          family: "DeepSeek",
          reasoning: true,
          input: ["text"],
          contextWindow: 64000,
          maxTokens: 8192,
          cost: {
            input: 0.55,
            output: 2.19,
            cacheRead: 0.14,
            cacheWrite: 0.55,
          },
          compat: {
            thinkingFormat: "deepseek",
          },
        },
        {
          id: "deepseek-chat",
          name: "DeepSeek V3",
          family: "DeepSeek",
          reasoning: false,
          input: ["text"],
          contextWindow: 64000,
          maxTokens: 8192,
          cost: {
            input: 0.27,
            output: 1.1,
            cacheRead: 0.07,
            cacheWrite: 0.27,
          },
        },
      ],
    },
    {
      id: "qwen-dashscope",
      name: "Qwen DashScope",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "$DASHSCOPE_API_KEY",
      api: "openai-completions",
      authHeader: true,
      enabled: true,
      compat: {
        thinkingFormat: "qwen",
      },
      models: [
        {
          id: "qwen-max",
          name: "Qwen Max",
          family: "Qwen",
          reasoning: false,
          input: ["text"],
          contextWindow: 32000,
          maxTokens: 8192,
          cost: {
            input: 2.0,
            output: 6.0,
            cacheRead: 0.5,
            cacheWrite: 2.0,
          },
        },
        {
          id: "qwq-32b",
          name: "QwQ-32B (Preview)",
          family: "Qwen",
          reasoning: true,
          input: ["text"],
          contextWindow: 128000,
          maxTokens: 8192,
          cost: {
            input: 0.5,
            output: 1.5,
            cacheRead: 0.1,
            cacheWrite: 0.5,
          },
          compat: {
            thinkingFormat: "qwen",
          },
        },
      ],
    },
  ],
};

const LOCAL_STORAGE_KEY = "pi_model_provider_manager_yaml_config";

/**
 * 加载 YAML 配置（优先本地持久化，容错回退）
 */
export function loadConfigFromYaml(): AppConfigYaml {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return YAML.parse(stored) as AppConfigYaml;
      }
    }
  } catch (e) {
    console.warn("Failed to load config from storage, using initial defaults:", e);
  }
  return INITIAL_CONFIG;
}

/**
 * 保存 YAML 配置
 */
export function saveConfigToYaml(config: AppConfigYaml): void {
  try {
    const yamlString = YAML.stringify(config);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, yamlString);
    }
  } catch (e) {
    console.error("Failed to save config to storage:", e);
  }
}
