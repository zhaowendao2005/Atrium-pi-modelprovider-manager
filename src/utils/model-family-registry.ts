import presetMapRaw from "../assets/model-family-preset.json";
import { safeFetch } from "./http.js";

/**
 * Cherry Studio models.json 备用镜像源矩阵 (含直连及 5 个 gh-proxy 加速节点)
 */
export const CHERRY_MODELS_MIRRORS: string[] = [
  "https://raw.githubusercontent.com/CherryHQ/cherry-studio/main/packages/provider-registry/data/models.json",
  "https://axisnow.gh-proxy.org/https://raw.githubusercontent.com/CherryHQ/cherry-studio/main/packages/provider-registry/data/models.json",
  "https://cdn.gh-proxy.org/https://raw.githubusercontent.com/CherryHQ/cherry-studio/main/packages/provider-registry/data/models.json",
  "https://v6.gh-proxy.org/https://raw.githubusercontent.com/CherryHQ/cherry-studio/main/packages/provider-registry/data/models.json",
  "https://v4.gh-proxy.org/https://raw.githubusercontent.com/CherryHQ/cherry-studio/main/packages/provider-registry/data/models.json",
  "https://gh-proxy.org/https://raw.githubusercontent.com/CherryHQ/cherry-studio/main/packages/provider-registry/data/models.json",
];

const STORAGE_KEY = "pi_model_family_registry_cache";
const CHECK_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 小时检查冷却期

interface RegistryCacheData {
  etag: string;
  lastCheckTime: number;
  preferredMirror: string;
  dynamicMap: Record<string, string>;
}

// 内置静态预设字典
const presetMap: Record<string, string> = presetMapRaw as Record<string, string>;

// 动态增量字典（从远端同步后保存）
let dynamicMap: Record<string, string> = {};
let lastEtag = "";
let lastCheckTime = 0;
let preferredMirror = CHERRY_MODELS_MIRRORS[0];
let isChecking = false;

// 初始化读取本地持久化缓存
try {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    const parsed: RegistryCacheData = JSON.parse(cached);
    if (parsed.dynamicMap && typeof parsed.dynamicMap === "object") {
      dynamicMap = parsed.dynamicMap;
    }
    if (parsed.etag) lastEtag = parsed.etag;
    if (parsed.lastCheckTime) lastCheckTime = parsed.lastCheckTime;
    if (parsed.preferredMirror) preferredMirror = parsed.preferredMirror;
  }
} catch (err) {
  console.warn("[ModelFamilyRegistry] Failed to load local cache:", err);
}

function saveCache() {
  try {
    const data: RegistryCacheData = {
      etag: lastEtag,
      lastCheckTime,
      preferredMirror,
      dynamicMap,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[ModelFamilyRegistry] Failed to save local cache:", err);
  }
}

/**
 * 规范化系列名称
 */
export function normalizeFamilyName(model: { id?: string; family?: string; ownedBy?: string }): string {
  const fam = (model.family || "").toLowerCase();
  const owned = (model.ownedBy || "").toLowerCase();
  const id = (model.id || "").toLowerCase();

  if (fam.includes("claude") || owned === "anthropic" || id.includes("claude")) return "Claude";

  if (
    fam === "gpt" ||
    fam.startsWith("gpt-") ||
    fam === "o" ||
    fam.startsWith("o-") ||
    owned === "openai" ||
    id.includes("gpt") ||
    id.startsWith("o1") ||
    id.startsWith("o3") ||
    id.startsWith("o4")
  ) {
    return "GPT";
  }

  if (fam.includes("deepseek") || owned === "deepseek" || id.includes("deepseek")) return "DeepSeek";

  if (fam.includes("qwen") || fam === "qvq" || owned === "alibaba" || id.includes("qwen") || id.includes("qwq")) {
    return "Qwen";
  }

  if (fam.includes("gemini") || fam.includes("gemma") || owned === "google" || id.includes("gemini") || id.includes("gemma")) {
    return "Gemini";
  }

  if (fam.includes("llama") || owned === "meta" || id.includes("llama")) return "Llama";

  if (
    fam.includes("mistral") ||
    fam.includes("codestral") ||
    fam.includes("mixtral") ||
    fam.includes("pixtral") ||
    fam.includes("ministral") ||
    owned === "mistral" ||
    id.includes("mistral") ||
    id.includes("codestral")
  ) {
    return "Mistral";
  }

  if (fam.includes("glm") || owned === "zhipu" || id.includes("glm")) return "GLM";

  if (fam.includes("kimi") || owned === "moonshot" || id.includes("kimi") || id.includes("moonshot")) return "Kimi";

  if (fam.includes("minimax") || owned === "minimax" || id.includes("abab")) return "MiniMax";

  if (fam === "yi" || owned === "01-ai" || id.startsWith("yi-")) return "Yi";

  if (fam.includes("grok") || owned === "xai" || id.includes("grok")) return "Grok";

  if (model.family && model.family.trim()) {
    return model.family.charAt(0).toUpperCase() + model.family.slice(1);
  }

  return "Other";
}

/**
 * 剥离常见厂商命名空间前缀（中转站、路由网关常见格式）
 */
function stripNamespace(id: string): string {
  const slashIdx = id.indexOf("/");
  if (slashIdx !== -1 && slashIdx < id.length - 1) {
    return id.substring(slashIdx + 1);
  }
  const colonIdx = id.indexOf(":");
  if (colonIdx !== -1 && colonIdx < id.length - 1) {
    return id.substring(colonIdx + 1);
  }
  return id;
}

/**
 * 从模型库字典中高精度匹配系列名称
 */
export function getRegisteredFamily(modelId: string): string | null {
  if (!modelId || !modelId.trim()) return null;

  const raw = modelId.trim();
  const lower = raw.toLowerCase();

  // 1. 精确匹配（优先动态库，其次内置静态库）
  if (dynamicMap[raw]) return dynamicMap[raw];
  if (presetMap[raw]) return presetMap[raw];
  if (dynamicMap[lower]) return dynamicMap[lower];
  if (presetMap[lower]) return presetMap[lower];

  // 2. 剥离前缀（如 "openai/gpt-4o", "deepseek-ai/deepseek-r1"）
  const stripped = stripNamespace(raw);
  const strippedLower = stripped.toLowerCase();
  if (stripped !== raw) {
    if (dynamicMap[stripped]) return dynamicMap[stripped];
    if (presetMap[stripped]) return presetMap[stripped];
    if (dynamicMap[strippedLower]) return dynamicMap[strippedLower];
    if (presetMap[strippedLower]) return presetMap[strippedLower];
  }

  // 3. 常见连字符变体匹配
  const cleanId = strippedLower.replace(/[-_]+/g, "-");
  for (const [key, fam] of Object.entries(dynamicMap)) {
    if (key.toLowerCase().replace(/[-_]+/g, "-") === cleanId) return fam;
  }
  for (const [key, fam] of Object.entries(presetMap)) {
    if (key.toLowerCase().replace(/[-_]+/g, "-") === cleanId) return fam;
  }

  return null;
}

export interface CheckUpdateResult {
  updated: boolean;
  checked: boolean;
  currentEtag: string;
  totalModels: number;
  mirrorUsed: string;
  message: string;
}

/**
 * 获取有序镜像源列表（将上一次成功的源排在首位）
 */
function getOrderedMirrors(): string[] {
  const mirrors = [...CHERRY_MODELS_MIRRORS];
  const idx = mirrors.indexOf(preferredMirror);
  if (idx > 0) {
    mirrors.splice(idx, 1);
    mirrors.unshift(preferredMirror);
  }
  return mirrors;
}

/**
 * 轻量级 HEAD 检测与故障转移轮询更新
 * @param force 是否忽略 24 小时冷却时间强制检查
 */
export async function checkFamilyMapUpdate(force = false): Promise<CheckUpdateResult> {
  const now = Date.now();
  const totalCachedCount = Object.keys({ ...presetMap, ...dynamicMap }).length;

  if (isChecking) {
    return {
      updated: false,
      checked: false,
      currentEtag: lastEtag,
      totalModels: totalCachedCount,
      mirrorUsed: preferredMirror,
      message: "正在检查中，请勿重复操作",
    };
  }

  if (!force && lastCheckTime > 0 && now - lastCheckTime < CHECK_COOLDOWN_MS) {
    return {
      updated: false,
      checked: false,
      currentEtag: lastEtag,
      totalModels: totalCachedCount,
      mirrorUsed: preferredMirror,
      message: "当前已在冷却周期内，无需频繁检查",
    };
  }

  isChecking = true;
  const mirrors = getOrderedMirrors();
  let headSuccessMirror = "";
  let remoteEtag = "";

  try {
    // 1. 尝试通过 HEAD 请求获取 ETag (单节点短超时 3500ms)
    for (const mirror of mirrors) {
      try {
        const res = await safeFetch(mirror, {
          method: "HEAD",
          signal: AbortSignal.timeout(3500),
        });

        if (res.ok) {
          const etagHeader = res.headers.get("etag") || res.headers.get("x-tag") || "";
          headSuccessMirror = mirror;
          remoteEtag = etagHeader.replace(/^(W\/)?"|"/g, ""); // 去除双引号与弱标签前缀
          preferredMirror = mirror; // 记住有效节点
          break;
        }
      } catch {
        // 静默切换到下一个镜像源重试
      }
    }

    // 若所有节点 HEAD 均不可达
    if (!headSuccessMirror) {
      return {
        updated: false,
        checked: false,
        currentEtag: lastEtag,
        totalModels: totalCachedCount,
        mirrorUsed: "",
        message: "所有镜像备用源均连接超时，已保留离线内置字典",
      };
    }

    lastCheckTime = now;

    // 2. 毫秒级比对：若 ETag 与本地一致，0 流量下载，立即判定最新
    if (remoteEtag && lastEtag && remoteEtag === lastEtag) {
      saveCache();
      return {
        updated: false,
        checked: true,
        currentEtag: remoteEtag,
        totalModels: totalCachedCount,
        mirrorUsed: headSuccessMirror,
        message: "模型映射库已是最新版本 (零流量校验完成)",
      };
    }

    // 3. ETag 变化或首次无 ETag，发起 GET 请求拉取最新 models.json
    let fullJsonData: any = null;
    let getSuccessMirror = "";

    for (const mirror of mirrors) {
      try {
        const res = await safeFetch(mirror, {
          method: "GET",
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          fullJsonData = await res.json();
          getSuccessMirror = mirror;
          break;
        }
      } catch {
        // 自动重试下一个
      }
    }

    if (fullJsonData && fullJsonData.models && Array.isArray(fullJsonData.models)) {
      const newMap: Record<string, string> = {};
      for (const m of fullJsonData.models) {
        if (m.id) {
          newMap[m.id] = normalizeFamilyName(m);
        }
      }

      dynamicMap = newMap;
      lastEtag = remoteEtag || fullJsonData.version || String(Date.now());
      saveCache();

      const newTotal = Object.keys({ ...presetMap, ...dynamicMap }).length;
      return {
        updated: true,
        checked: true,
        currentEtag: lastEtag,
        totalModels: newTotal,
        mirrorUsed: getSuccessMirror,
        message: `模型映射库同步成功，共收录 ${newTotal} 个模型`,
      };
    }

    return {
      updated: false,
      checked: true,
      currentEtag: lastEtag,
      totalModels: totalCachedCount,
      mirrorUsed: headSuccessMirror,
      message: "拉取数据解析异常，已沿用当前映射表",
    };
  } finally {
    isChecking = false;
  }
}

/**
 * 获取当前注册表统计信息
 */
export function getRegistryStats() {
  const combined = { ...presetMap, ...dynamicMap };
  return {
    totalModels: Object.keys(combined).length,
    presetCount: Object.keys(presetMap).length,
    dynamicCount: Object.keys(dynamicMap).length,
    lastCheckTime,
    lastEtag,
    preferredMirror,
  };
}
