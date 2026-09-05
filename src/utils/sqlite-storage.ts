import { invoke } from "@tauri-apps/api/core";
import type { ProviderSchema, ModelSchema, ProviderPresetSummary, ProviderPresetDetails } from "../types/index.js";

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
      console.error("[sqlite-storage] Failed to load from SQLite:", err);
    }
  }
  throw new Error("SQLite is unavailable outside the Tauri desktop runtime");
}

export async function dbLoadSettings(): Promise<Record<string, unknown>> {
  if (!isTauriEnvironment()) throw new Error("SQLite is unavailable outside the Tauri desktop runtime");
  return (await invoke("app_meta_load")) as Record<string, unknown>;
}

export async function dbSaveSettings(settings: Record<string, unknown>): Promise<void> {
  if (!isTauriEnvironment()) throw new Error("SQLite is unavailable outside the Tauri desktop runtime");
  await invoke("app_meta_save", { settings });
}

export async function dbGetPath(): Promise<string> {
  if (!isTauriEnvironment()) throw new Error("Tauri runtime is unavailable");
  return (await invoke("db_get_path")) as string;
}

export async function dbGetStats(): Promise<{ providers: number; models: number }> {
  if (!isTauriEnvironment()) throw new Error("Tauri runtime is unavailable");
  return (await invoke("db_get_stats")) as { providers: number; models: number };
}

export async function dbBackup(): Promise<string> {
  if (!isTauriEnvironment()) throw new Error("Tauri runtime is unavailable");
  return (await invoke("db_backup")) as string;
}

export async function dbExportJson(): Promise<string> {
  if (!isTauriEnvironment()) throw new Error("Tauri runtime is unavailable");
  return (await invoke("db_export_json")) as string;
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
  throw new Error("SQLite is unavailable outside the Tauri desktop runtime");
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
  throw new Error("SQLite is unavailable outside the Tauri desktop runtime");
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
  throw new Error("SQLite is unavailable outside the Tauri desktop runtime");
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
  throw new Error("SQLite is unavailable outside the Tauri desktop runtime");
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
