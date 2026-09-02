import { defineStore } from "pinia";
import type { AppSettings } from "../types/index.js";
import { loadConfigFromYaml, saveConfigToYaml, INITIAL_CONFIG } from "../utils/storage.js";
import { useProviderStore } from "./provider.js";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    settings: { ...INITIAL_CONFIG.settings } as AppSettings,
  }),

  actions: {
    init() {
      const config = loadConfigFromYaml();
      this.settings = { ...config.settings };
      this.applyTheme(this.settings.theme);
    },

    updateSettings(partial: Partial<AppSettings>) {
      this.settings = { ...this.settings, ...partial };
      if (partial.theme) {
        this.applyTheme(partial.theme);
      }
      this.persist();
    },

    setTheme(theme: "light" | "dark" | "auto") {
      this.updateSettings({ theme });
    },

    applyTheme(theme: "light" | "dark" | "auto") {
      const root = document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else if (theme === "light") {
        root.classList.remove("dark");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }
    },

    persist() {
      const providerStore = useProviderStore();
      saveConfigToYaml({
        version: 1,
        settings: this.settings,
        providers: providerStore.providers,
      });
    },
  },
});
