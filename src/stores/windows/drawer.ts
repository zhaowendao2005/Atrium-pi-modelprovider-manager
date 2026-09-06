import { defineStore } from "pinia";
import type { ProviderSchema, ModelSchema } from "../../types/index.js";

export type DrawerType = "provider-add" | "provider-edit" | "model-add" | "model-edit" | null;

export const useDrawerStore = defineStore("drawer", {
  state: () => ({
    isOpen: false as boolean,
    drawerType: null as DrawerType,
    targetProviderId: null as string | null,
    editingProvider: null as ProviderSchema | null,
    editingModel: null as ModelSchema | null,
    // 二级抽屉：字段详情文档
    isFieldDocOpen: false as boolean,
    activeDocField: null as string | null,
    // 测试工作台：任务资料抽屉（计划文档 / 参考资料 / 期望产出）
    isTestTaskMaterialsOpen: false as boolean,
    testTaskMaterialTab: "plan" as "plan" | "docs" | "outputs",
    activeTestTaskDocName: null as string | null,
    // 测试工作台：任务元信息详情抽屉
    isTestTaskDetailsOpen: false as boolean,
    // 测试工作台：时序指标抽屉
    isTestMetricsOpen: false as boolean,
    activeMetricsSessionId: null as string | null,
    // 测试工作台：批量发布模态框
    isBatchTestModalOpen: false as boolean,
    // 测试工作台：全屏发起新测试模态框
    isLauncherModalOpen: false as boolean,
    // 测试工作台：全屏放大卡片会话模态框
    focusedModalSessionId: null as string | null,
  }),

  actions: {
    openFieldDoc(field: string) {
      this.activeDocField = field;
      this.isFieldDocOpen = true;
    },

    closeFieldDoc() {
      this.isFieldDocOpen = false;
      this.activeDocField = null;
    },

    openTestTaskMaterials(tab: "plan" | "docs" | "outputs" = "plan") {
      this.testTaskMaterialTab = tab;
      this.activeTestTaskDocName = null;
      this.isTestTaskMaterialsOpen = true;
    },

    setTestTaskMaterialTab(tab: "plan" | "docs" | "outputs") {
      this.testTaskMaterialTab = tab;
    },

    openTestTaskDoc(name: string) {
      this.activeTestTaskDocName = name;
      this.testTaskMaterialTab = "docs";
      this.isTestTaskMaterialsOpen = true;
    },

    closeTestTaskMaterials() {
      this.isTestTaskMaterialsOpen = false;
      this.activeTestTaskDocName = null;
    },

    openTestTaskDetails() {
      this.isTestTaskDetailsOpen = true;
    },

    closeTestTaskDetails() {
      this.isTestTaskDetailsOpen = false;
    },

    openTestMetrics(sessionId?: string) {
      if (sessionId) {
        this.activeMetricsSessionId = sessionId;
      }
      this.isTestMetricsOpen = true;
    },

    closeTestMetrics() {
      this.isTestMetricsOpen = false;
    },

    openBatchTestModal() {
      this.isBatchTestModalOpen = true;
    },

    closeBatchTestModal() {
      this.isBatchTestModalOpen = false;
    },

    openLauncherModal() {
      this.isLauncherModalOpen = true;
    },

    closeLauncherModal() {
      this.isLauncherModalOpen = false;
    },

    openFocusedModal(sessionId: string) {
      this.focusedModalSessionId = sessionId;
    },

    closeFocusedModal() {
      this.focusedModalSessionId = null;
    },

    openProviderDrawer(type: "provider-add" | "provider-edit", provider?: ProviderSchema) {
      this.drawerType = type;
      if (type === "provider-edit" && provider) {
        this.editingProvider = JSON.parse(JSON.stringify(provider));
        if (!this.editingProvider!.headers) this.editingProvider!.headers = {};
        if (!this.editingProvider!.compat) this.editingProvider!.compat = {};
        if (!this.editingProvider!.env) this.editingProvider!.env = {};
      } else {
        this.editingProvider = {
          id: "",
          name: "",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "",
          api: "openai-completions",
          authHeader: true,
          enabled: true,
          autoDiscover: true,
          headers: {},
          env: {},
          compat: {
            supportsUsageInStreaming: true,
            supportsDeveloperRole: true,
          },
          models: [],
        };
      }
      this.isOpen = true;
    },

    openModelDrawer(type: "model-add" | "model-edit", providerId: string, model?: ModelSchema) {
      this.drawerType = type;
      this.targetProviderId = providerId;
      if (type === "model-edit" && model) {
        this.editingModel = JSON.parse(JSON.stringify(model));
        if (!this.editingModel!.headers) this.editingModel!.headers = {};
        if (!this.editingModel!.samplingParams) this.editingModel!.samplingParams = {};
        if (!this.editingModel!.thinkingLevelMap) this.editingModel!.thinkingLevelMap = {};
        if (!this.editingModel!.compat) this.editingModel!.compat = {};
        if (!this.editingModel!.cost) {
          this.editingModel!.cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, tiers: [] };
        } else if (!this.editingModel!.cost.tiers) {
          this.editingModel!.cost.tiers = [];
        }
      } else {
        this.editingModel = {
          id: "",
          name: "",
          family: "Other",
          reasoning: false,
          input: ["text"],
          contextWindow: 128000,
          maxTokens: 16384,
          headers: {},
          samplingParams: {},
          thinkingLevelMap: {},
          compat: {},
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            tiers: [],
          },
        };
      }
      this.isOpen = true;
    },

    closeDrawer() {
      this.isOpen = false;
      this.drawerType = null;
      this.editingProvider = null;
      this.editingModel = null;
      this.targetProviderId = null;
    },
  },
});
