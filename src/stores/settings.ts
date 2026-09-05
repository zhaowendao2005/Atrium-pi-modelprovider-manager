import { defineStore } from "pinia";
import type { AppSettings } from "../types/index.js";
import { dbLoadSettings, dbSaveSettings } from "../utils/sqlite-storage.js";
import { INITIAL_SETTINGS } from "../utils/storage.js";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    settings: { ...INITIAL_SETTINGS } as AppSettings,
    initialized: false,
  }),

  actions: {
    async init() {
      try {
        const stored = await dbLoadSettings();
        this.settings = { ...INITIAL_SETTINGS, ...stored } as AppSettings;
      } catch (err) {
        console.error("[settingsStore] SQLite load failed:", err);
        this.settings = { ...INITIAL_SETTINGS };
        throw err;
      } finally {
        this.initialized = true;
        this.applyTheme(this.settings.theme);
      }
    },

    updateSettings(partial: Partial<AppSettings>) {
      this.settings = { ...this.settings, ...partial };
      if (partial.theme) this.applyTheme(partial.theme);
      void this.persist();
    },

    setTheme(theme: "light" | "dark" | "auto") {
      this.updateSettings({ theme });
    },

    applyTheme(theme: "light" | "dark" | "auto") {
      const root = document.documentElement;
      if (theme === "dark") root.classList.add("dark");
      else if (theme === "light") root.classList.remove("dark");
      else root.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
    },

    async persist() {
      try {
        await dbSaveSettings(this.settings as unknown as Record<string, unknown>);
      } catch (err) {
        console.error("[settingsStore] SQLite save failed:", err);
      }
    },
  },
});
