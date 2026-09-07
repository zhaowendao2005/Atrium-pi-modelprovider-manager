/**
 * 提供商 Logo 识别与映射工具 (基于 Cherry Studio 预设体系)
 */

const providerAssets = import.meta.glob<string>(
  "../assets/images/providers/*.{png,webp,svg,jpeg}",
  { eager: true, import: "default" }
);

const modelAssets = import.meta.glob<string>(
  "../assets/images/models/*.{png,webp,svg,jpeg}",
  { eager: true, import: "default" }
);

const providerFileMap = new Map<string, string>();

for (const [path, url] of Object.entries(providerAssets)) {
  const fileName = path.split("/").pop();
  if (fileName) providerFileMap.set(fileName, url);
}

for (const [path, url] of Object.entries(modelAssets)) {
  const fileName = path.split("/").pop();
  if (fileName) providerFileMap.set(`model:${fileName}`, url);
}

function resolveProviderFile(fileName: string): string | undefined {
  return providerFileMap.get(fileName) || providerFileMap.get(`model:${fileName}`);
}

/**
 * 常见厂商 Preset/ID 到图标静态资源映射表
 */
const PROVIDER_MAP: Record<string, string> = {
  // 国际知名厂商
  openai: "openai.png",
  chatgpt: "openai.png",
  anthropic: "anthropic.png",
  claude: "anthropic.png",
  google: "google.png",
  gemini: "google.png",
  vertexai: "vertexai.svg",
  "azure-openai": "model:microsoft.png",
  azure: "model:microsoft.png",
  microsoft: "model:microsoft.png",
  groq: "groq.png",
  cerebras: "cerebras.webp",
  openrouter: "openrouter.png",
  github: "github.png",
  copilot: "github.png",
  perplexity: "perplexity.png",
  mistral: "mistral.png",
  cohere: "cohere.png",
  together: "together.png",
  togetherai: "together.png",
  fireworks: "fireworks.png",
  hyperbolic: "hyperbolic.png",
  lepton: "lepton.png",
  huggingface: "huggingface.webp",
  aws: "aws-bedrock.webp",
  bedrock: "aws-bedrock.webp",
  vercel: "vercel.svg",
  grok: "grok.png",
  xai: "grok.png",
  voyageai: "voyageai.png",
  nomic: "nomic.png",

  // 本地离线与运行时
  ollama: "ollama.png",
  lmstudio: "lmstudio.png",
  gpustack: "gpustack.svg",
  ovms: "intel.png",
  intel: "intel.png",

  // 国内主流大模型提供商
  deepseek: "deepseek.png",
  siliconflow: "silicon.png",
  silicon: "silicon.png",
  moonshot: "moonshot.webp",
  kimi: "moonshot.webp",
  zhipu: "zhipu.png",
  glm: "zhipu.png",
  bigmodel: "zhipu.png",
  dashscope: "dashscope.png",
  bailian: "bailian.png",
  aliyun: "dashscope.png",
  alibaba: "dashscope.png",
  qwen: "dashscope.png",
  modelscope: "modelscope.png",
  doubao: "doubao.png",
  volcengine: "volcengine.png",
  bytedance: "doubao.png",
  baichuan: "baichuan.png",
  minimax: "minimax.png",
  "minimax-global": "minimax.png",
  stepfun: "step.png",
  step: "step.png",
  "01-ai": "zero-one.png",
  zeroone: "zero-one.png",
  yi: "zero-one.png",
  hunyuan: "model:hunyuan.png",
  tencent: "tencent-cloud-ti.png",
  "tencent-cloud-ti": "tencent-cloud-ti.png",
  "baidu-cloud": "baidu-cloud.svg",
  baidu: "baidu-cloud.svg",
  wenxin: "baidu-cloud.svg",
  zhinao: "model:360.png",
  "360": "model:360.png",
  jina: "jina.png",

  // 聚合中转与网关
  "302ai": "302ai.webp",
  aihubmix: "aihubmix.png",
  alayanew: "alayanew.webp",
  burncloud: "burncloud.png",
  cephalon: "cephalon.jpeg",
  cherryin: "cherryin.png",
  dmxapi: "DMXAPI.png",
  infini: "infini.png",
  lanyun: "lanyun.png",
  longcat: "longcat.png",
  newapi: "newapi.png",
  oneapi: "newapi.png",
  ocoolai: "ocoolai.png",
  ph8: "ph8.png",
  ppio: "ppio.png",
  qiniu: "qiniu.webp",
  sophnet: "sophnet.svg",
  tokenflux: "tokenflux.png",
  xirang: "xirang.png",
  zai: "zai.svg",
  "gitee-ai": "gitee-ai.png",
};

/**
 * 根据提供商 ID、预设 ID 或名称查找提供商 Logo
 */
export function getProviderLogoById(idOrName: string | undefined | null): string | undefined {
  if (!idOrName) return undefined;
  const key = idOrName.trim().toLowerCase();

  // 1. 精确匹配映射表
  if (PROVIDER_MAP[key]) {
    const asset = resolveProviderFile(PROVIDER_MAP[key]);
    if (asset) return asset;
  }

  // 2. 遍历包含匹配
  for (const [mapKey, fileName] of Object.entries(PROVIDER_MAP)) {
    if (key.includes(mapKey)) {
      const asset = resolveProviderFile(fileName);
      if (asset) return asset;
    }
  }

  return undefined;
}

/**
 * 获取 Provider 实体的对应 Logo（结合 appliedPreset、basePresetId、id 与 name 逐级推断）
 */
export function getProviderLogo(
  provider: { id?: string; name?: string; appliedPreset?: string; basePresetId?: string } | undefined | null
): string | undefined {
  if (!provider) return undefined;

  // 1. 优先使用套用的预设标识 (appliedPreset / basePresetId)
  if (provider.appliedPreset && provider.appliedPreset !== "custom") {
    const byPreset = getProviderLogoById(provider.appliedPreset);
    if (byPreset) return byPreset;
  }
  if (provider.basePresetId) {
    const byBasePreset = getProviderLogoById(provider.basePresetId);
    if (byBasePreset) return byBasePreset;
  }

  // 2. 其次使用提供商唯一 ID
  if (provider.id) {
    const byId = getProviderLogoById(provider.id);
    if (byId) return byId;
  }

  // 3. 最后使用提供商 Display Name
  if (provider.name) {
    const byName = getProviderLogoById(provider.name);
    if (byName) return byName;
  }

  return undefined;
}
