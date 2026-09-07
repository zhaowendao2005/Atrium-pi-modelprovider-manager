/**
 * 模型 Logo 智能推断与匹配工具 (基于 Cherry Studio 规则库与 Vite 静态资源索引)
 */

// 1. 批量加载本地模型与补充图标资源
const modelAssets = import.meta.glob<string>(
  "../assets/images/models/*.{png,webp,svg,jpeg}",
  { eager: true, import: "default" }
);

const providerAssets = import.meta.glob<string>(
  "../assets/images/providers/*.{png,webp,svg,jpeg}",
  { eager: true, import: "default" }
);

const appAssets = import.meta.glob<string>(
  "../assets/images/apps/*.{png,webp,svg,jpeg}",
  { eager: true, import: "default" }
);

// 提取出文件名 -> URL 的快速查找表
const fileMap = new Map<string, string>();

for (const [path, url] of Object.entries(modelAssets)) {
  const fileName = path.split("/").pop();
  if (fileName) fileMap.set(fileName, url);
}

for (const [path, url] of Object.entries(providerAssets)) {
  const fileName = path.split("/").pop();
  if (fileName) fileMap.set(`provider:${fileName}`, url);
}

for (const [path, url] of Object.entries(appAssets)) {
  const fileName = path.split("/").pop();
  if (fileName) fileMap.set(`app:${fileName}`, url);
}

function resolveAsset(fileName: string): string | undefined {
  return fileMap.get(fileName) || fileMap.get(`provider:${fileName}`) || fileMap.get(`app:${fileName}`);
}

interface LogoRule {
  pattern: RegExp;
  light: string;
  dark?: string;
}

// 模型匹配规则列表（继承自 Cherry Studio 生产级映射表）
const MODEL_RULES: LogoRule[] = [
  { pattern: /pixtral/i, light: "pixtral.png", dark: "pixtral_dark.png" },
  { pattern: /jina/i, light: "jina.png", dark: "jina_dark.png" },
  { pattern: /(abab|minimax|m2-her)/i, light: "minimax.png", dark: "minimax_dark.png" },
  { pattern: /veo/i, light: "gemini.png", dark: "gemini_dark.png" },
  { pattern: /(o1|o3|o4)/i, light: "gpt_o1.png", dark: "gpt_dark.png" },
  { pattern: /gpt-image/i, light: "gpt_image_1.png" },
  { pattern: /gpt-5\.1-chat/i, light: "gpt-5.1-chat.png" },
  { pattern: /gpt-5\.1-codex-mini/i, light: "gpt-5.1-codex-mini.png" },
  { pattern: /gpt-5\.1-codex/i, light: "gpt-5.1-codex.png" },
  { pattern: /gpt-5\.1/i, light: "gpt-5.1.png" },
  { pattern: /gpt-5-mini/i, light: "gpt-5-mini.png" },
  { pattern: /gpt-5-nano/i, light: "gpt-5-nano.png" },
  { pattern: /gpt-5-chat/i, light: "gpt-5-chat.png" },
  { pattern: /gpt-5-codex/i, light: "gpt-5-codex.png" },
  { pattern: /gpt-5/i, light: "gpt-5.png" },
  { pattern: /gpt-4/i, light: "gpt_4.png", dark: "gpt_dark.png" },
  { pattern: /gpt-3/i, light: "gpt_3.5.png", dark: "gpt_dark.png" },
  { pattern: /gpts/i, light: "gpt_4.png", dark: "gpt_dark.png" },
  { pattern: /(gpt-oss|text-moderation|babbage-|sora-|sora_|(^|\/)omni-)/i, light: "chatgpt.jpeg", dark: "gpt_dark.png" },
  { pattern: /Embedding-V1/i, light: "wenxin.png", dark: "wenxin_dark.png" },
  { pattern: /text-embedding-v/i, light: "qwen.png", dark: "qwen_dark.png" },
  { pattern: /(text-embedding|davinci-)/i, light: "chatgpt.jpeg", dark: "gpt_dark.png" },
  { pattern: /(chatglm|glm)/i, light: "chatglm.png", dark: "chatglm_dark.png" },
  { pattern: /deepseek/i, light: "deepseek.png", dark: "deepseek_dark.png" },
  { pattern: /(qwen|qwq|qwq-|qvq-|wan-)/i, light: "qwen.png", dark: "qwen_dark.png" },
  { pattern: /gemma/i, light: "gemma.png", dark: "gemma_dark.png" },
  { pattern: /yi-/i, light: "yi.png", dark: "yi_dark.png" },
  { pattern: /llama/i, light: "llama.png", dark: "llama_dark.png" },
  { pattern: /codestral/i, light: "codestral.png" },
  { pattern: /(mixtral|mistral|ministral|magistral)/i, light: "mixtral.png", dark: "mixtral_dark.png" },
  { pattern: /(moonshot|kimi)/i, light: "moonshot.webp", dark: "moonshot.webp" },
  { pattern: /phi/i, light: "microsoft.png", dark: "microsoft_dark.png" },
  { pattern: /baichuan/i, light: "baichuan.png", dark: "baichuan_dark.png" },
  { pattern: /(claude|anthropic-)/i, light: "claude.png", dark: "claude_dark.png" },
  { pattern: /gemini/i, light: "gemini.png", dark: "gemini_dark.png" },
  { pattern: /(bison|palm)/i, light: "palm.png", dark: "palm_dark.png" },
  { pattern: /step/i, light: "step.png", dark: "step_dark.png" },
  { pattern: /hailuo/i, light: "hailuo.png", dark: "hailuo_dark.png" },
  { pattern: /(doubao|seedream|ep-202)/i, light: "doubao.png", dark: "doubao_dark.png" },
  { pattern: /(cohere|command)/i, light: "cohere.png", dark: "cohere.png" },
  { pattern: /minicpm/i, light: "minicpm.webp", dark: "minicpm.webp" },
  { pattern: /360/i, light: "360.png", dark: "360_dark.png" },
  { pattern: /aimass/i, light: "aimass.png", dark: "aimass_dark.png" },
  { pattern: /codegeex/i, light: "codegeex.png", dark: "codegeex_dark.png" },
  { pattern: /(copilot|creative|balanced|precise)/i, light: "copilot.png", dark: "copilot_dark.png" },
  { pattern: /(dalle|dall-e)/i, light: "dalle.png", dark: "dalle_dark.png" },
  { pattern: /dbrx/i, light: "dbrx.png", dark: "dbrx_dark.png" },
  { pattern: /(flashaudio|voice)/i, light: "flashaudio.png", dark: "flashaudio_dark.png" },
  { pattern: /flux/i, light: "flux.png", dark: "flux_dark.png" },
  { pattern: /grok/i, light: "grok.png", dark: "grok_dark.png" },
  { pattern: /hunyuan/i, light: "hunyuan.png", dark: "hunyuan_dark.png" },
  { pattern: /internlm/i, light: "internlm.png", dark: "internlm_dark.png" },
  { pattern: /internvl/i, light: "internvl.png" },
  { pattern: /llava/i, light: "llava.png", dark: "llava_dark.png" },
  { pattern: /magic/i, light: "magic.png", dark: "magic_dark.png" },
  { pattern: /(midjourney|mj-)/i, light: "midjourney.png", dark: "midjourney_dark.png" },
  { pattern: /(tao-|ernie-)/i, light: "wenxin.png", dark: "wenxin_dark.png" },
  { pattern: /(tts-1|whisper-)/i, light: "chatgpt.jpeg", dark: "gpt_dark.png" },
  { pattern: /(stable-|sd2|sd3|sdxl)/i, light: "stability.png", dark: "stability_dark.png" },
  { pattern: /(sparkdesk|generalv)/i, light: "sparkdesk.png", dark: "sparkdesk_dark.png" },
  { pattern: /(wizardlm|microsoft)/i, light: "microsoft.png", dark: "microsoft_dark.png" },
  { pattern: /hermes/i, light: "nousresearch.png", dark: "nousresearch_dark.png" },
  { pattern: /(gryphe|mythomax)/i, light: "gryphe.png", dark: "gryphe_dark.png" },
  { pattern: /(suno|chirp)/i, light: "suno.png", dark: "suno_dark.png" },
  { pattern: /luma/i, light: "luma.png", dark: "luma_dark.png" },
  { pattern: /keling/i, light: "keling.png", dark: "keling_dark.png" },
  { pattern: /vidu-/i, light: "vidu.png", dark: "vidu_dark.png" },
  { pattern: /(ai21|jamba-)/i, light: "ai21.png", dark: "ai21_dark.png" },
  { pattern: /nvidia/i, light: "nvidia.png", dark: "nvidia_dark.png" },
  { pattern: /dianxin/i, light: "dianxin.png", dark: "dianxin_dark.png" },
  { pattern: /tele/i, light: "tele.png", dark: "tele_dark.png" },
  { pattern: /adept/i, light: "adept.png", dark: "adept_dark.png" },
  { pattern: /aisingapore/i, light: "aisingapore.png", dark: "aisingapore_dark.png" },
  { pattern: /bigcode/i, light: "bigcode.webp", dark: "bigcode_dark.webp" },
  { pattern: /mediatek/i, light: "mediatek.png", dark: "mediatek_dark.png" },
  { pattern: /upstage/i, light: "upstage.png", dark: "upstage_dark.png" },
  { pattern: /rakutenai/i, light: "rakutenai.png", dark: "rakutenai_dark.png" },
  { pattern: /ibm/i, light: "ibm.png", dark: "ibm_dark.png" },
  { pattern: /google\//i, light: "google.png", dark: "google.png" },
  { pattern: /xirang/i, light: "xirang.png", dark: "xirang_dark.png" },
  { pattern: /hugging/i, light: "huggingface.png", dark: "huggingface_dark.png" },
  { pattern: /youdao/i, light: "provider:netease-youdao.svg" },
  { pattern: /embedding-3/i, light: "provider:zhipu.png" },
  { pattern: /embedding/i, light: "embedding.png", dark: "embedding.png" },
  { pattern: /(perplexity|sonar)/i, light: "perplexity.png", dark: "perplexity.png" },
  { pattern: /bge-/i, light: "bge.webp" },
  { pattern: /voyage-/i, light: "voyageai.png" },
  { pattern: /tokenflux/i, light: "tokenflux.png", dark: "tokenflux_dark.png" },
  { pattern: /nomic-/i, light: "provider:nomic.png" },
  { pattern: /pangu-/i, light: "pangu.svg" },
  { pattern: /(cogview|zhipu)/i, light: "zhipu.png", dark: "zhipu_dark.png" },
  { pattern: /longcat/i, light: "app:longcat.svg" },
  { pattern: /bytedance/i, light: "byte_dance.svg" },
  { pattern: /(ling|ring)/i, light: "ling.png" },
  { pattern: /(V_1|V_1_TURBO|V_2|V_2A|V_2_TURBO|DESCRIBE|UPSCALE)/i, light: "ideogram.svg" },
  { pattern: /mimo/i, light: "mimo.svg" },
];

/**
 * 根据模型 ID 或名称推断对应的模型 Logo URL
 */
export function getModelLogoById(modelId: string | undefined | null, isDark = false): string | undefined {
  if (!modelId) return undefined;

  for (const rule of MODEL_RULES) {
    if (rule.pattern.test(modelId)) {
      const fileName = isDark && rule.dark ? rule.dark : rule.light;
      const resolved = resolveAsset(fileName);
      if (resolved) return resolved;
    }
  }

  return undefined;
}

/**
 * 获取模型实体专属的 Logo（具备三级降级策略）
 */
export function getModelLogo(
  model: { id?: string; name?: string; family?: string } | undefined | null,
  isDark = false
): string | undefined {
  if (!model) return undefined;

  // 1. 优先按 ID 匹配
  if (model.id) {
    const byId = getModelLogoById(model.id, isDark);
    if (byId) return byId;
  }

  // 2. 其次按 Name 匹配
  if (model.name) {
    const byName = getModelLogoById(model.name, isDark);
    if (byName) return byName;
  }

  // 3. 再次按 Family 系列降级匹配
  if (model.family) {
    const byFamily = getModelFamilyLogo(model.family, isDark);
    if (byFamily) return byFamily;
  }

  return undefined;
}

/**
 * 根据系列名称（Family）获取对应官方代表品牌 Logo
 */
export function getModelFamilyLogo(family: string | undefined | null, isDark = false): string | undefined {
  if (!family) return undefined;
  const fam = family.toLowerCase();

  if (fam === "claude" || fam.includes("anthropic")) {
    return resolveAsset(isDark ? "claude_dark.png" : "claude.png");
  }
  if (fam === "gpt" || fam.includes("openai")) {
    return resolveAsset(isDark ? "gpt_dark.png" : "gpt_4.png");
  }
  if (fam === "deepseek") {
    return resolveAsset(isDark ? "deepseek_dark.png" : "deepseek.png");
  }
  if (fam === "qwen" || fam.includes("alibaba")) {
    return resolveAsset(isDark ? "qwen_dark.png" : "qwen.png");
  }
  if (fam === "gemini" || fam === "gemma" || fam.includes("google")) {
    return resolveAsset(isDark ? "gemini_dark.png" : "gemini.png");
  }
  if (fam === "llama" || fam.includes("meta")) {
    return resolveAsset(isDark ? "llama_dark.png" : "llama.png");
  }
  if (fam === "mistral" || fam === "mixtral") {
    return resolveAsset(isDark ? "mixtral_dark.png" : "mixtral.png");
  }
  if (fam === "glm" || fam.includes("zhipu")) {
    return resolveAsset(isDark ? "chatglm_dark.png" : "chatglm.png");
  }
  if (fam === "kimi" || fam.includes("moonshot")) {
    return resolveAsset("moonshot.webp");
  }
  if (fam === "minimax") {
    return resolveAsset(isDark ? "minimax_dark.png" : "minimax.png");
  }
  if (fam === "yi") {
    return resolveAsset(isDark ? "yi_dark.png" : "yi.png");
  }
  if (fam === "baichuan") {
    return resolveAsset(isDark ? "baichuan_dark.png" : "baichuan.png");
  }
  if (fam === "hunyuan" || fam.includes("tencent")) {
    return resolveAsset(isDark ? "hunyuan_dark.png" : "hunyuan.png");
  }
  if (fam === "doubao" || fam.includes("bytedance")) {
    return resolveAsset(isDark ? "doubao_dark.png" : "doubao.png");
  }

  // 兜底直接尝试 ID 推断
  return getModelLogoById(family, isDark);
}
