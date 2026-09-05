<template>
  <div class="flex h-full w-full overflow-hidden select-none">
    <!-- Left Column: Provider List Sub-Sidebar (Single line items) -->
    <ProviderSidebarList />

    <!-- Right Column: Active Provider Details & Model Tree -->
    <div
      v-if="providerStore.activeProvider"
      class="flex-1 h-full flex flex-col min-w-0 bg-background/50 overflow-hidden"
    >
      <!-- Clean Compact Top Header Bar (参考图 2) -->
      <div class="px-6 py-3.5 border-b border-border/60 bg-card/40 backdrop-blur-md flex items-center justify-between gap-3 flex-shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <h2 class="text-base font-bold text-foreground truncate">
            {{ providerStore.activeProvider.name || providerStore.activeProvider.id }}
          </h2>

          <!-- Edit Settings SVG Icon Button -->
          <button
            type="button"
            title="编辑提供商配置"
            class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            @click="drawerStore.openProviderDrawer('provider-edit', providerStore.activeProvider)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <Badge size="sm" variant="secondary" class="text-[11px] px-2 py-0.5">
            {{ providerStore.activeProvider.api || 'openai-completions' }}
          </Badge>
        </div>

        <!-- Right: Active Switch Toggle -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <Switch
            :model-value="providerStore.activeProvider.enabled !== false"
            @update:model-value="toggleActive"
          />
        </div>
      </div>

      <!-- Main Content with AppleScrollArea -->
      <AppleScrollArea class="flex-1 px-6 py-5">
        <div class="max-w-4xl flex flex-col gap-6">
          <!-- Section 1: API 密钥 & API 地址 (集中展示端点与鉴权，参考图 2) -->
          <div class="flex flex-col gap-4">
            <!-- API 密钥 -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-foreground">API 密钥</label>
              <div class="flex items-center gap-2">
                <div class="relative flex-1">
                  <input
                    :type="showApiKey ? 'text' : 'password'"
                    :value="providerStore.activeProvider.apiKey || ''"
                    placeholder="未配置 API Key（支持 $ENV_VAR）"
                    class="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl pl-3.5 pr-10 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                    @input="onApiKeyInput"
                  />
                  <!-- Toggle Show/Hide Key SVG Button -->
                  <button
                    type="button"
                    title="显示/隐藏密钥"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                    @click="showApiKey = !showApiKey"
                  >
                    <svg v-if="!showApiKey" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  </button>
                </div>

                <!-- Test Latency / Signal SVG Button (测速) -->
                <Button
                  size="sm"
                  variant="outline"
                  class="h-9 px-3 gap-1.5"
                  :loading="providerStore.isTestingConnection"
                  title="测速当前端点与密钥连通性"
                  @click="providerStore.testConnection(providerStore.activeProvider.id)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span v-if="providerStore.testResult?.latencyMs" class="font-mono text-xs">
                    {{ providerStore.testResult.latencyMs }}ms
                  </span>
                  <span v-else class="text-xs">测试连通性</span>
                </Button>
              </div>

              <!-- Test result message banner if any -->
              <div
                v-if="providerStore.testResult"
                class="mt-1 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all"
                :class="[
                  providerStore.testResult.ok
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-destructive/10 text-destructive border border-destructive/20',
                ]"
              >
                <span>{{ providerStore.testResult.message }}</span>
                <span v-if="providerStore.testResult.latencyMs" class="font-mono font-semibold">
                  {{ providerStore.testResult.latencyMs }}ms
                </span>
              </div>
            </div>

            <!-- API 地址 -->
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-foreground">API 地址</label>
                <button
                  type="button"
                  class="text-[11px] text-primary hover:underline flex items-center gap-1"
                  @click="drawerStore.openProviderDrawer('provider-edit', providerStore.activeProvider)"
                >
                  高级协议配置
                </button>
              </div>
              <div class="relative">
                <input
                  type="text"
                  :value="providerStore.activeProvider.baseUrl"
                  placeholder="https://api.openai.com/v1"
                  class="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 pr-10 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  @input="onBaseUrlInput"
                />
                <!-- Settings Drawer trigger button inside input -->
                <button
                  type="button"
                  title="端点高级参数设置"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                  @click="drawerStore.openProviderDrawer('provider-edit', providerStore.activeProvider)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </button>
              </div>

              <!-- 2 行小字：预览当前模型 Fetch 地址和请求地址 -->
              <div class="mt-1.5 flex flex-col gap-0.5 text-[11px] font-mono text-muted-foreground/80 select-all">
                <div class="flex items-center gap-1.5 truncate">
                  <span class="text-muted-foreground/60 font-sans font-medium flex-shrink-0">请求地址:</span>
                  <span class="truncate text-foreground/80">{{ providerStore.activeProvider.baseUrl || '-' }}</span>
                </div>
                <div class="flex items-center gap-1.5 truncate">
                  <span class="text-muted-foreground/60 font-sans font-medium flex-shrink-0">模型 Fetch 地址:</span>
                  <span class="truncate text-primary/90 font-medium">{{ currentModelFetchUrl }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 2: 模型 (二级树，参考图 2) -->
          <div class="flex flex-col gap-3 pt-2">
            <!-- Model Section Header -->
            <div class="flex items-center justify-between pb-1">
              <div class="flex items-center gap-3">
                <h3 class="text-sm font-bold text-foreground">
                  模型 ({{ providerStore.totalModelCount }})
                </h3>

                <!-- Filter pill tabs -->
                <div class="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg">
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded-md text-xs transition-colors"
                    :class="[
                      providerStore.selectedFamily === 'all'
                        ? 'bg-card text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    ]"
                    @click="providerStore.selectedFamily = 'all'"
                  >
                    全部
                  </button>
                  <button
                    v-for="family in providerStore.modelFamilies"
                    :key="family"
                    type="button"
                    class="px-2 py-0.5 rounded-md text-xs transition-colors"
                    :class="[
                      providerStore.selectedFamily === family
                        ? 'bg-card text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    ]"
                    @click="providerStore.selectedFamily = family"
                  >
                    {{ family }}
                  </button>
                </div>
              </div>

              <!-- Right Actions: Discover Models & Add Model -->
              <div class="flex items-center gap-2">
                <!-- Sync / Discover Models Button -->
                <Button
                  size="sm"
                  variant="outline"
                  class="h-8 px-2.5 text-xs gap-1.5"
                  :loading="isDiscovering"
                  title="从 /v1/models 接口自动拉取可用模型"
                  @click="discoverRemoteModels"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>获取模型列表</span>
                </Button>

                <!-- Add Model Button -->
                <Button
                  size="sm"
                  variant="primary"
                  class="h-8 px-2.5 text-xs gap-1"
                  title="手动挂载新模型"
                  @click="drawerStore.openModelDrawer('model-add', providerStore.activeProvider.id)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>挂载模型</span>
                </Button>
              </div>
            </div>

            <!-- Two-Level Tree: Level 1 (Family Groups), Level 2 (Single-line Model Rows) -->
            <div
              v-if="Object.keys(providerStore.groupedModels).length === 0"
              class="h-48 flex flex-col items-center justify-center text-center text-muted-foreground border border-dashed border-border rounded-2xl"
            >
              <p class="text-xs font-medium text-foreground">暂无挂载的模型</p>
              <p class="text-[11px] text-muted-foreground mt-0.5">
                可点击右上角「获取模型列表」自动探测或「挂载模型」手动添加。
              </p>
            </div>

            <div v-else class="flex flex-col gap-3">
              <ModelFamilyGroup
                v-for="(models, family) in providerStore.groupedModels"
                :key="family"
                :family="family"
                :models="models"
                :provider-id="providerStore.activeProvider.id"
              />
            </div>
          </div>
        </div>
      </AppleScrollArea>
    </div>

    <!-- Empty State if no provider selected -->
    <div
      v-else
      class="flex-1 h-full flex flex-col items-center justify-center text-center text-muted-foreground"
    >
      <div class="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-2.5">
        <svg class="w-6 h-6 text-muted-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <p class="text-sm font-semibold text-foreground">未选择模型提供商</p>
      <p class="text-xs text-muted-foreground mt-0.5">
        请在左侧列表中选择一个提供商，或点击「新建」添加。
      </p>
    </div>

    <!-- Model Discovery & Batch Add Dialog (Teleported to body) -->
    <ModelDiscoveryDialog
      v-if="providerStore.activeProvider"
      v-model="isDiscoveryDialogOpen"
      :provider-id="providerStore.activeProvider.id"
      :provider-name="providerStore.activeProvider.name || providerStore.activeProvider.id"
      :fetch-url="currentModelFetchUrl"
      :raw-models="discoveredRawModels"
      :existing-model-ids="currentProviderModelIds"
      @confirm="handleConfirmAddModels"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useProviderStore } from "../../stores/provider.js";
import { useDrawerStore } from "../../stores/windows/drawer.js";
import { usePresetsStore } from "../../stores/presets.js";
import type { ModelSchema } from "../../types/index.js";
import { safeFetch } from "../../utils/http.js";
import { guessModelFamily, guessModelCapabilities } from "../../utils/model-family.js";
import ProviderSidebarList from "./components/ProviderSidebarList.vue";
import ModelFamilyGroup from "./components/ModelFamilyGroup.vue";
import ModelDiscoveryDialog from "./components/ModelDiscoveryDialog.vue";
import Button from "../../components/ui/Button.vue";
import Badge from "../../components/ui/Badge.vue";
import Switch from "../../components/ui/Switch.vue";
import AppleScrollArea from "../../components/ui/AppleScrollArea.vue";

const providerStore = useProviderStore();
const drawerStore = useDrawerStore();
const presetsStore = usePresetsStore();

const showApiKey = ref(false);
const isDiscovering = ref(false);

// Dialog state
const isDiscoveryDialogOpen = ref(false);
const discoveredRawModels = ref<Array<{ id: string; name?: string; [key: string]: any }>>([]);

const currentModelFetchUrl = computed(() => {
  const p = providerStore.activeProvider;
  if (!p || !p.baseUrl) return "-";
  return p.discoveryEndpoint || `${p.baseUrl.replace(/\/+$/, "")}/models`;
});

const currentProviderModelIds = computed(() => {
  return providerStore.activeProvider?.models?.map((m) => m.id) || [];
});

function toggleActive(val: boolean) {
  if (providerStore.activeProvider) {
    providerStore.activeProvider.enabled = val;
    providerStore.persist();
  }
}

function onApiKeyInput(e: Event) {
  const target = e.target as HTMLInputElement;
  if (providerStore.activeProvider) {
    providerStore.activeProvider.apiKey = target.value;
    providerStore.persist();
  }
}

function onBaseUrlInput(e: Event) {
  const target = e.target as HTMLInputElement;
  if (providerStore.activeProvider) {
    providerStore.activeProvider.baseUrl = target.value;
    providerStore.persist();
  }
}

async function discoverRemoteModels() {
  const p = providerStore.activeProvider;
  if (!p || !p.baseUrl) return;

  isDiscovering.value = true;
  try {
    const endpoint = currentModelFetchUrl.value;
    const headers: Record<string, string> = { ...p.headers };
    if (p.apiKey && !p.apiKey.startsWith("$")) {
      headers["Authorization"] = `Bearer ${p.apiKey}`;
    }

    const res = await safeFetch(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const json = await res.json();
      let list: Array<{ id: string; name?: string }> = [];

      if (json.data && Array.isArray(json.data)) {
        list = json.data;
      } else if (Array.isArray(json)) {
        list = json;
      } else if (json.models && Array.isArray(json.models)) {
        list = json.models;
      }

      if (list.length > 0) {
        discoveredRawModels.value = list.filter((item) => item && typeof item.id === "string" && item.id.trim().length > 0);
        isDiscoveryDialogOpen.value = true;
      } else {
        alert("未能从端点返回的数据中解析出模型列表。请检查返回格式是否包含 data 或 models 字段。");
      }
    } else {
      alert(`获取模型列表失败: HTTP ${res.status} ${res.statusText}`);
    }
  } catch (err: any) {
    alert(`获取模型列表异常: ${err?.message || String(err)}`);
  } finally {
    isDiscovering.value = false;
  }
}

async function handleConfirmAddModels(selectedIds: string[]) {
  const p = providerStore.activeProvider;
  if (!p || selectedIds.length === 0) return;

  if (!p.models) p.models = [];
  const existingIds = new Set(p.models.map((m) => m.id));

  let addedCount = 0;
  let matchedCount = 0;

  for (const id of selectedIds) {
    if (!existingIds.has(id)) {
      const bestPreset = await presetsStore.findGlobalBestMatchModel(id, p.id);
      const caps = guessModelCapabilities(id);

      const newModel: ModelSchema = {
        id,
        name: id,
        family: guessModelFamily(id),
        reasoning: caps.reasoning,
        input: caps.vision ? ["text", "image"] : ["text"],
        contextWindow: caps.contextWindow,
        maxTokens: caps.maxTokens,
      };

      if (bestPreset) {
        presetsStore.applyModelPreset(newModel, bestPreset);
        newModel.id = id; // 保持远端实际拉取的原始 ID
        matchedCount++;
      }

      p.models.push(newModel);
      addedCount++;
    }
  }

  providerStore.persist(true);
  isDiscoveryDialogOpen.value = false;
}
</script>
