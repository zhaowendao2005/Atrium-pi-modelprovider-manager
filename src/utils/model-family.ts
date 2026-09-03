import { getRegisteredFamily } from "./model-family-registry.js";

/**
 * 模型系列与能力推断工具
 */

export const MODEL_FAMILY_ORDER: string[] = [
  "Claude",
  "GPT",
  "DeepSeek",
  "Qwen",
  "Gemini",
  "Llama",
  "Mistral",
  "GLM",
  "Kimi",
  "MiniMax",
  "Yi",
  "Baichuan",
  "Hunyuan",
  "Doubao",
  "Other",
];

export function guessModelFamily(id: string): string {
  // 1. 优先查 Cherry Studio 注册字典 (支持精确匹配、命名空间剥离与连字符变体)
  const registered = getRegisteredFamily(id);
  if (registered) return registered;

  const lower = id.toLowerCase();

  if (lower.includes("claude")) return "Claude";

  if (
    lower.includes("gpt") ||
    lower.includes("o1") ||
    lower.includes("o3") ||
    lower.includes("o4") ||
    lower.includes("chatgpt") ||
    lower.includes("text-embedding") ||
    lower.includes("text-davinci") ||
    lower.includes("dall-e") ||
    lower.includes("whisper")
  ) {
    return "GPT";
  }

  if (lower.includes("deepseek") || lower.includes("deep-seek")) return "DeepSeek";

  if (lower.includes("qwen") || lower.includes("qwq") || lower.includes("qvq")) return "Qwen";

  if (lower.includes("gemini") || lower.includes("gemma")) return "Gemini";

  if (lower.includes("llama") || lower.includes("meta-llama")) return "Llama";

  if (
    lower.includes("mistral") ||
    lower.includes("codestral") ||
    lower.includes("mixtral") ||
    lower.includes("pixtral") ||
    lower.includes("ministral")
  ) {
    return "Mistral";
  }

  if (lower.includes("glm") || lower.includes("chatglm") || lower.includes("cogview")) return "GLM";

  if (lower.includes("moonshot") || lower.includes("kimi")) return "Kimi";

  if (lower.includes("minimax") || lower.includes("abab")) return "MiniMax";

  if (lower.startsWith("yi-") || lower.includes("/yi-") || lower.includes("01-ai/yi")) return "Yi";

  if (lower.includes("baichuan")) return "Baichuan";

  if (lower.includes("hunyuan")) return "Hunyuan";

  if (lower.includes("doubao") || lower.includes("skylark")) return "Doubao";

  return "Other";
}

export interface ModelGuessedCapabilities {
  reasoning: boolean;
  vision: boolean;
  embedding: boolean;
  contextWindow: number;
  maxTokens: number;
}

export function guessModelCapabilities(id: string): ModelGuessedCapabilities {
  const lower = id.toLowerCase();

  const reasoning =
    lower.includes("reasoner") ||
    lower.includes("r1") ||
    lower.includes("o1") ||
    lower.includes("o3") ||
    lower.includes("o4") ||
    lower.includes("thinking") ||
    lower.includes("qwq");

  const vision =
    lower.includes("vision") ||
    lower.includes("4o") ||
    lower.includes("vl") ||
    lower.includes("multimodal") ||
    lower.includes("pixtral") ||
    lower.includes("qvq") ||
    lower.includes("gemini") ||
    lower.includes("claude-3");

  const embedding =
    lower.includes("embed") ||
    lower.includes("text-embedding") ||
    lower.includes("bge-") ||
    lower.includes("gte-");

  let contextWindow = 128000;
  let maxTokens = 16384;

  if (lower.includes("gemini-1.5") || lower.includes("gemini-2.0")) {
    contextWindow = 1048576;
    maxTokens = 65536;
  } else if (lower.includes("claude-3-5") || lower.includes("claude-3-7")) {
    contextWindow = 200000;
    maxTokens = 64000;
  } else if (lower.includes("deepseek-r1") || lower.includes("deepseek-v3")) {
    contextWindow = 64000;
    maxTokens = 8192;
  } else if (lower.includes("qwen2.5-32b") || lower.includes("qwen2.5-72b")) {
    contextWindow = 131072;
    maxTokens = 8192;
  }

  return {
    reasoning,
    vision,
    embedding,
    contextWindow,
    maxTokens,
  };
}
