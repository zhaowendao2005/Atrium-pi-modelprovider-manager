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
    activeProviderId: "",
    configStoragePath: "~/.pi/pi-modelprovider-manager-data/config.yaml",
  },
  providers: [],
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
