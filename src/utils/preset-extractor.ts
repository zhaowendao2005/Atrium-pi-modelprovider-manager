import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { pathToFileURL } from "node:url";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { ModelSchema, ProviderPresetSummary, ProviderPresetDetails } from "../types/index.js";

export interface SyncPresetsResult {
  updated: boolean;
  version: string;
  providerCount: number;
  modelCount: number;
}

/**
 * 确保目录存在
 */
function ensureDirSync(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 将 provider ID 转换为人类友好的展示名称
 */
function formatProviderDisplayName(id: string): string {
  const nameMap: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google Gemini",
    "google-vertex": "Google Vertex AI",
    deepseek: "DeepSeek",
    xai: "xAI (Grok)",
    zai: "ZAI 智谱清言",
    "zai-coding-cn": "ZAI 智谱 (国内专线)",
    openrouter: "OpenRouter",
    "github-copilot": "GitHub Copilot",
    "amazon-bedrock": "Amazon Bedrock",
    "azure-openai-responses": "Azure OpenAI",
    together: "Together AI",
    fireworks: "Fireworks AI",
    groq: "Groq",
    cerebras: "Cerebras",
    baseten: "Baseten",
    minimax: "MiniMax",
    "minimax-cn": "MiniMax (国内专线)",
    mistral: "Mistral AI",
    moonshotai: "Moonshot AI (Kimi)",
    "moonshotai-cn": "Moonshot AI (国内专线)",
    "kimi-coding": "Kimi For Coding",
    opencode: "OpenCode",
    "opencode-go": "OpenCode Go",
    "cloudflare-ai-gateway": "Cloudflare AI Gateway",
    "cloudflare-workers-ai": "Cloudflare Workers AI",
    "qwen-token-plan": "通义千问 Qwen (国际)",
    "qwen-token-plan-cn": "通义千问 Qwen (国内)",
    "qwen-token-plan-individual": "通义千问 Qwen (个人版)",
    xiaomi: "小米 MiMo",
    "vercel-ai-gateway": "Vercel AI Gateway",
    nvidia: "NVIDIA NIM",
  };

  if (nameMap[id]) return nameMap[id];
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * 在没有源码的生产环境下：
 * 1. 动态自检 @earendil-works/pi-coding-agent 的 package.json 版本；
 * 2. 对比 presets-meta.json 中的已缓存版本；
 * 3. 若版本发生升级或首次运行，动态提取 TypeBox 校验 Schema 与 1290+ 个内置模型预设；
 * 4. 采用渐进式架构切分落盘：
 *    - presets/index.json (~2KB 轻量索引)
 *    - presets/<providerId>.json (单提供商独立文件)
 *    - schemas.json (标准字段元数据)
 *    - presets-meta.json (版本标记)
 */
function getDefaultStorageDir(): string {
  const home = os.homedir();
  const legacyRoot = path.join(home, ".pi", "pi-modelprovider-manager-data");
  const atriumRoot = path.join(home, ".pi", "atrium-pi-modelprovider-manager-data");
  const root = fs.existsSync(atriumRoot) || !fs.existsSync(legacyRoot) ? atriumRoot : legacyRoot;
  return process.env.PI_MODEL_MANAGER_ENV === "development" ? path.join(root, "dev-cache") : root;
}

export async function syncPresetsAndSchemas(targetDir?: string, force = false): Promise<SyncPresetsResult> {
  const baseDir = targetDir || getDefaultStorageDir();
  ensureDirSync(baseDir);

  const presetsDir = path.join(baseDir, "presets");
  ensureDirSync(presetsDir);

  const metaPath = path.join(baseDir, "presets-meta.json");
  const schemasPath = path.join(baseDir, "schemas.json");
  const indexPath = path.join(presetsDir, "index.json");

  // 1. 读取生产包版本
  let currentVersion = "0.84.4-grok-adapter-2";
  try {
    const pkgPath = path.resolve(process.cwd(), "node_modules/@earendil-works/pi-coding-agent/package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.version) currentVersion = `${pkg.version}-grok-adapter-2`;
    }
  } catch (e) {
    console.warn("[preset-extractor] Could not resolve package.json version, using fallback:", e);
  }

  // 2. 检查是否需要更新
  // The catalog includes project-owned Grok entries, so never skip regeneration based
  // only on the upstream Pi version cache.
  let needUpdate = true;
  let cachedModelCount = 0;
  if (!force && fs.existsSync(metaPath) && fs.existsSync(schemasPath) && fs.existsSync(indexPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (meta.version === currentVersion) {
        needUpdate = false;
        cachedModelCount = meta.modelCount || 0;
      }
    } catch {
      needUpdate = true;
    }
  }

  if (!needUpdate) {
    let providerCount = 0;
    try {
      const indexList = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      providerCount = Array.isArray(indexList) ? indexList.length : 0;
    } catch {}
    return {
      updated: false,
      version: currentVersion,
      providerCount,
      modelCount: cachedModelCount,
    };
  }

  console.log(`[preset-extractor] Syncing presets and schemas for version ${currentVersion}...`);

  // 3. 动态提取 Schema
  try {
    const srcFile = path.resolve(process.cwd(), "node_modules/@earendil-works/pi-coding-agent/dist/core/model-config.js");
    if (fs.existsSync(srcFile)) {
      const coreDir = path.dirname(srcFile);
      const tempFile = path.join(coreDir, `temp-export-schema-${Date.now()}.js`);
      let content = fs.readFileSync(srcFile, "utf-8");
      content += "\nexport { ProviderConfigSchema, ModelDefinitionSchema, ProviderCompatSchema };";
      fs.writeFileSync(tempFile, content, "utf-8");

      try {
        const imported = await import(pathToFileURL(tempFile).href);
        fs.writeFileSync(
          schemasPath,
          JSON.stringify(
            {
              provider: imported.ProviderConfigSchema,
              model: imported.ModelDefinitionSchema,
              compat: imported.ProviderCompatSchema,
            },
            null,
            2
          ),
          "utf-8"
        );
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    }
  } catch (err) {
    console.warn("[preset-extractor] Failed to dynamically extract schemas.json:", err);
  }

  // 4. 从 ModelRuntime 提取 1290+ 个模型预设
  const runtime = await ModelRuntime.create();
  const allModels = runtime.getModels();

  const providerMap = new Map<string, ProviderPresetDetails>();

  for (const m of allModels) {
    const pid = m.provider;
    if (!providerMap.has(pid)) {
      providerMap.set(pid, {
        id: pid,
        name: formatProviderDisplayName(pid),
        baseUrl: m.baseUrl,
        defaultApi: m.api as any,
        compat: m.compat as any,
        models: [],
      });
    }

    const p = providerMap.get(pid)!;
    p.models.push({
      id: m.id,
      name: m.name,
      api: m.api as any,
      baseUrl: m.baseUrl,
      reasoning: m.reasoning,
      input: m.input as any,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      thinkingLevelMap: m.thinkingLevelMap,
      cost: m.cost,
      compat: m.compat as any,
      appliedPreset: m.id,
    });
  }

  // Grok's relay presets are maintained by this project because the Pi catalog is
  // not guaranteed to contain the full xAI/Grok Build catalog.
  const grokSpecs: Array<[string, string, boolean, number, number, ("text" | "image")[]]> = [
    ["grok-4.6", "Grok 4.6", true, 500000, 131072, ["text", "image"]],
    ["grok-composer-2.5-fast", "Composer 2.5", false, 200000, 30000, ["text"]],
    ["grok-build", "Grok Build", true, 500000, 30000, ["text", "image"]],
    ["grok-4.5", "Grok 4.5", true, 500000, 131072, ["text", "image"]],
    ["grok-4.3", "Grok 4.3", true, 1000000, 131072, ["text", "image"]],
    ["grok-4.20-0309-reasoning", "Grok 4.20 Reasoning", true, 2000000, 131072, ["text", "image"]],
    ["grok-4.20-0309-non-reasoning", "Grok 4.20 Non-Reasoning", false, 2000000, 131072, ["text", "image"]],
    ["grok-4.20-multi-agent-0309", "Grok 4.20 Multi-Agent", true, 2000000, 131072, ["text", "image"]],
  ];
  const grokModels: ModelSchema[] = grokSpecs.map(([id, name, reasoning, contextWindow, maxTokens, input]) => ({
    id, name, reasoning, contextWindow, maxTokens, input,
    api: "openai-responses", appliedPreset: id,
    cost: { input: 1, output: 2, cacheRead: 0.2, cacheWrite: 0.2 },
  }));
  const xai = providerMap.get("xai");
  if (xai) {
    const existing = new Set(xai.models.map((model) => model.id));
    xai.models.push(...grokModels.filter((model) => !existing.has(model.id)));
  } else {
    providerMap.set("xai", { id: "xai", name: "xAI", defaultApi: "openai-responses", models: grokModels });
  }

  // 5. 渐进式多文件落盘
  const indexList: ProviderPresetSummary[] = [];

  for (const [pid, details] of providerMap.entries()) {
    indexList.push({
      id: pid,
      name: details.name,
      defaultApi: details.defaultApi,
      modelCount: details.models.length,
    });

    const providerFilePath = path.join(presetsDir, `${pid}.json`);
    fs.writeFileSync(providerFilePath, JSON.stringify(details, null, 2), "utf-8");
  }

  // 按字母排序索引
  indexList.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(indexPath, JSON.stringify(indexList, null, 2), "utf-8");

  const totalModelCount = Array.from(providerMap.values()).reduce((sum, provider) => sum + provider.models.length, 0);

  // 写入版本元数据
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        version: currentVersion,
        updatedAt: new Date().toISOString(),
        providerCount: indexList.length,
        modelCount: totalModelCount,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(
    `[preset-extractor] Sync complete: ${indexList.length} providers, ${totalModelCount} models saved.`
  );

  return {
    updated: true,
    version: currentVersion,
    providerCount: indexList.length,
    modelCount: totalModelCount,
  };
}
