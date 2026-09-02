import { defineStore } from "pinia";
import type { ProviderSchema, ModelSchema } from "../types/index.js";
import { loadConfigFromYaml, saveConfigToYaml } from "../utils/storage.js";
import { useSettingsStore } from "./settings.js";

export const useProviderStore = defineStore("provider", {
  state: () => ({
    providers: [] as ProviderSchema[],
    activeProviderId: "" as string,
    searchQuery: "" as string,
    selectedFamily: "all" as string,
    isTestingConnection: false as boolean,
    testResult: null as { ok: boolean; message: string; latencyMs?: number } | null,
  }),

  getters: {
    activeProvider: (state): ProviderSchema | undefined => {
      return (
        state.providers.find((p) => p.id === state.activeProviderId) ||
        state.providers[0]
      );
    },

    filteredProviders: (state): ProviderSchema[] => {
      if (!state.searchQuery.trim()) return state.providers;
      const q = state.searchQuery.toLowerCase();
      return state.providers.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.baseUrl.toLowerCase().includes(q)
      );
    },

    /**
     * 获取当前选中 Provider 的所有模型系列分类
     */
    modelFamilies(): string[] {
      const provider = this.activeProvider;
      if (!provider || !provider.models) return [];
      const set = new Set<string>();
      for (const m of provider.models) {
        set.add(m.family || "Other");
      }
      return Array.from(set).sort();
    },

    /**
     * 当前 Provider 的模型按系列分组
     */
    groupedModels(): Record<string, ModelSchema[]> {
      const provider = this.activeProvider;
      if (!provider || !provider.models) return {};

      const groups: Record<string, ModelSchema[]> = {};
      for (const m of provider.models) {
        const family = m.family || "Other";
        if (
          this.selectedFamily !== "all" &&
          this.selectedFamily.toLowerCase() !== family.toLowerCase()
        ) {
          continue;
        }
        if (!groups[family]) {
          groups[family] = [];
        }
        groups[family].push(m);
      }
      return groups;
    },

    totalModelCount(): number {
      const provider = this.activeProvider;
      return provider?.models?.length ?? 0;
    },
  },

  actions: {
    init() {
      const config = loadConfigFromYaml();
      this.providers = config.providers;
      this.activeProviderId =
        config.settings.activeProviderId || this.providers[0]?.id || "";
    },

    persist() {
      const settingsStore = useSettingsStore();
      saveConfigToYaml({
        version: 1,
        settings: {
          ...settingsStore.settings,
          activeProviderId: this.activeProviderId,
        },
        providers: this.providers,
      });
    },

    setActiveProvider(id: string) {
      this.activeProviderId = id;
      this.selectedFamily = "all";
      this.testResult = null;
      this.persist();
    },

    addProvider(provider: ProviderSchema) {
      this.providers.push({
        ...provider,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      this.activeProviderId = provider.id;
      this.persist();
    },

    updateProvider(provider: ProviderSchema) {
      const index = this.providers.findIndex((p) => p.id === provider.id);
      if (index !== -1) {
        this.providers[index] = {
          ...provider,
          updatedAt: Date.now(),
        };
        this.persist();
      }
    },

    deleteProvider(id: string) {
      this.providers = this.providers.filter((p) => p.id !== id);
      if (this.activeProviderId === id) {
        this.activeProviderId = this.providers[0]?.id || "";
      }
      this.persist();
    },

    toggleProvider(id: string) {
      const p = this.providers.find((item) => item.id === id);
      if (p) {
        p.enabled = p.enabled !== false ? false : true;
        p.updatedAt = Date.now();
        this.persist();
      }
    },

    addModel(providerId: string, model: ModelSchema) {
      const p = this.providers.find((item) => item.id === providerId);
      if (p) {
        if (!p.models) p.models = [];
        p.models.push(model);
        p.updatedAt = Date.now();
        this.persist();
      }
    },

    updateModel(providerId: string, model: ModelSchema) {
      const p = this.providers.find((item) => item.id === providerId);
      if (p && p.models) {
        const index = p.models.findIndex((m) => m.id === model.id);
        if (index !== -1) {
          p.models[index] = model;
          p.updatedAt = Date.now();
          this.persist();
        }
      }
    },

    deleteModel(providerId: string, modelId: string) {
      const p = this.providers.find((item) => item.id === providerId);
      if (p && p.models) {
        p.models = p.models.filter((m) => m.id !== modelId);
        p.updatedAt = Date.now();
        this.persist();
      }
    },

    async testConnection(providerId: string) {
      const target = this.providers.find((p) => p.id === providerId);
      if (!target) return;

      this.isTestingConnection = true;
      this.testResult = null;
      const start = Date.now();

      try {
        const endpoint = target.discoveryEndpoint
          ? target.discoveryEndpoint
          : `${target.baseUrl.replace(/\/+$/, "")}/models`;

        const headers: Record<string, string> = { ...target.headers };
        if (target.apiKey && !target.apiKey.startsWith("$")) {
          headers["Authorization"] = `Bearer ${target.apiKey}`;
        }

        const res = await fetch(endpoint, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(8000),
        });

        const latencyMs = Date.now() - start;
        if (res.ok) {
          this.testResult = {
            ok: true,
            message: `连接成功 (HTTP ${res.status})`,
            latencyMs,
          };
        } else {
          this.testResult = {
            ok: false,
            message: `响应异常: HTTP ${res.status} ${res.statusText}`,
            latencyMs,
          };
        }
      } catch (err: any) {
        this.testResult = {
          ok: false,
          message: `连接失败: ${err?.message || String(err)}`,
          latencyMs: Date.now() - start,
        };
      } finally {
        this.isTestingConnection = false;
      }
    },
  },
});
