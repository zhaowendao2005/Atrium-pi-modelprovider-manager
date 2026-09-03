import { invoke } from "@tauri-apps/api/core";
import type { ProviderSchema, ModelSchema, ProviderPresetSummary, ProviderPresetDetails } from "../types/index.js";
import { INITIAL_CONFIG } from "./storage.js";

/**
 * 检查当前是否运行在 Tauri 桌面端环境
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
}

/**
 * 从 SQLite 加载所有提供商及其旗下模型
 */
export async function dbLoadAllProviders(): Promise<ProviderSchema[]> {
  if (isTauriEnvironment()) {
    try {
      const res = (await invoke("db_load_all")) as { providers: ProviderSchema[] };
      if (res && Array.isArray(res.providers)) {
        return res.providers;
      }
    } catch (err) {
      console.warn("[sqlite-storage] Failed to load from SQLite, will try initial fallback:", err);
    }
  }
  return [];
}

/**
 * 保存单个提供商到 SQLite (Upsert)
 */
export async function dbSaveProvider(provider: ProviderSchema): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      await invoke("db_save_provider", { provider });
      return;
    } catch (err) {
      console.error("[sqlite-storage] db_save_provider error:", err);
      throw err;
    }
  }
}

/**
 * 保存单个模型到 SQLite (Upsert)
 */
export async function dbSaveModel(providerId: string, model: ModelSchema): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      await invoke("db_save_model", { providerId, model });
      return;
    } catch (err) {
      console.error("[sqlite-storage] db_save_model error:", err);
      throw err;
    }
  }
}

/**
 * 从 SQLite 中删除提供商
 */
export async function dbDeleteProvider(id: string): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      await invoke("db_delete_provider", { id });
      return;
    } catch (err) {
      console.error("[sqlite-storage] db_delete_provider error:", err);
      throw err;
    }
  }
}

/**
 * 从 SQLite 中删除模型
 */
export async function dbDeleteModel(providerId: string, modelId: string): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      await invoke("db_delete_model", { providerId, modelId });
      return;
    } catch (err) {
      console.error("[sqlite-storage] db_delete_model error:", err);
      throw err;
    }
  }
}

/**
 * 渐进式 Level 0: 获取官方提供商预设索引列表 (~2KB)
 */
export async function fetchPresetIndex(): Promise<ProviderPresetSummary[]> {
  if (isTauriEnvironment()) {
    try {
      const res = (await invoke("get_preset_index")) as ProviderPresetSummary[];
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch (err) {
      console.warn("[sqlite-storage] get_preset_index error:", err);
    }
  }
  return [];
}

/**
 * 渐进式 Level 1: 按需加载某个提供商的完整预设详情与包含模型
 */
export async function fetchProviderPreset(providerId: string): Promise<ProviderPresetDetails | null> {
  if (isTauriEnvironment()) {
    try {
      const res = (await invoke("get_provider_preset", { providerId })) as ProviderPresetDetails;
      return res || null;
    } catch (err) {
      console.warn(`[sqlite-storage] get_provider_preset for ${providerId} error:`, err);
    }
  }
  return null;
}
