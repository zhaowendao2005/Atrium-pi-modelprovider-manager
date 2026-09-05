import type { AppSettings } from "../types/index.js";

export const DEFAULT_STORAGE_DIR = "~/.pi/pi-modelprovider-manager-data";
export const DATABASE_FILE_NAME = "manager.db";

export const INITIAL_SETTINGS: AppSettings = {
  theme: "auto",
  enableHeaderTrace: true,
  enableAutoOverflowRecovery: true,
  activeProviderId: "",
};
