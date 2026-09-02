<template>
  <Sheet
    :model-value="drawerStore.isOpen && (drawerStore.drawerType === 'provider-add' || drawerStore.drawerType === 'provider-edit')"
    :title="drawerStore.drawerType === 'provider-add' ? '添加模型提供商' : '编辑模型提供商'"
    description="配置网关端点、底层通信协议 (9 种支持格式) 及鉴权参数"
    @update:model-value="val => { if (!val) drawerStore.closeDrawer() }"
  >
    <div v-if="drawerStore.editingProvider" class="flex flex-col gap-5 text-sm">
      <!-- Basic Config Section -->
      <div class="flex flex-col gap-3.5">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          基础接入信息
        </h4>

        <!-- ID -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            唯一标识 (Provider ID) <span class="text-destructive">*</span>
          </label>
          <Input
            v-model="drawerStore.editingProvider.id"
            placeholder="例如: my-oneapi 或 openai-proxy"
            :disabled="drawerStore.drawerType === 'provider-edit'"
          />
        </div>

        <!-- Name -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            显示名称 (Display Name)
          </label>
          <Input
            v-model="drawerStore.editingProvider.name"
            placeholder="例如: OneAPI 聚合网关"
          />
        </div>

        <!-- Base URL -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            Base URL 端点 <span class="text-destructive">*</span>
          </label>
          <Input
            v-model="drawerStore.editingProvider.baseUrl"
            placeholder="例如: https://api.openai.com/v1"
          />
        </div>

        <!-- Protocol Select (9 Wire Protocols) -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            底层通信协议 (Wire Protocol)
          </label>
          <Select
            v-model="drawerStore.editingProvider.api"
            :options="protocolOptions"
          />
          <p class="text-[11px] text-muted-foreground">
            通用中转站和开源推理引擎（vLLM, Ollama, SGLang）请选择 openai-completions
          </p>
        </div>

        <!-- API Key -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            API Key / 鉴权令牌
          </label>
          <Input
            v-model="drawerStore.editingProvider.apiKey"
            type="password"
            placeholder="支持 $ENV_VAR 环境变量引用或明文 Key"
          />
        </div>
      </div>

      <!-- Switches Section -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          协议与发现控制
        </h4>

        <!-- Enabled Switch -->
        <div class="flex items-center justify-between py-1">
          <div>
            <div class="font-medium text-xs text-foreground">启用提供商</div>
            <div class="text-[11px] text-muted-foreground">禁用后将不会向 Pi 运行时注册该提供商</div>
          </div>
          <Switch v-model="drawerStore.editingProvider.enabled" />
        </div>

        <!-- Auth Header Switch -->
        <div class="flex items-center justify-between py-1">
          <div>
            <div class="font-medium text-xs text-foreground">自动注入 Bearer Token</div>
            <div class="text-[11px] text-muted-foreground">自动附带 Authorization: Bearer &lt;key&gt; 请求头</div>
          </div>
          <Switch v-model="drawerStore.editingProvider.authHeader" />
        </div>

        <!-- Auto Discover Switch -->
        <div class="flex items-center justify-between py-1">
          <div>
            <div class="font-medium text-xs text-foreground">动态模型自动发现</div>
            <div class="text-[11px] text-muted-foreground">向 /v1/models 发起探测并自动拉取最新模型</div>
          </div>
          <Switch v-model="drawerStore.editingProvider.autoDiscover" />
        </div>
      </div>

      <!-- Compat Settings Section -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          兼容性适配矩阵 (Compat)
        </h4>

        <div v-if="drawerStore.editingProvider.compat" class="flex flex-col gap-3">
          <!-- Thinking Format Select -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">思考链传递格式 (Thinking Format)</label>
            <Select
              v-model="drawerStore.editingProvider.compat.thinkingFormat"
              :options="thinkingFormatOptions"
            />
          </div>

          <div class="flex items-center justify-between py-1">
            <span class="text-xs text-foreground">流式包含 Token 统计 (include_usage)</span>
            <Switch v-model="drawerStore.editingProvider.compat.supportsUsageInStreaming" />
          </div>

          <div class="flex items-center justify-between py-1">
            <span class="text-xs text-foreground">自适应思考格式 (Claude Adaptive)</span>
            <Switch v-model="drawerStore.editingProvider.compat.forceAdaptiveThinking" />
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <Button variant="ghost" size="sm" @click="drawerStore.closeDrawer">
        取消
      </Button>
      <Button variant="primary" size="sm" @click="saveProvider">
        保存并应用
      </Button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import { useProviderStore } from "../../../stores/provider.js";
import Sheet from "../../../components/ui/Sheet.vue";
import Input from "../../../components/ui/Input.vue";
import Select, { type SelectOption } from "../../../components/ui/Select.vue";
import Switch from "../../../components/ui/Switch.vue";
import Button from "../../../components/ui/Button.vue";

const drawerStore = useDrawerStore();
const providerStore = useProviderStore();

const protocolOptions: SelectOption[] = [
  { label: "OpenAI Completions (/v1/chat/completions)", value: "openai-completions" },
  { label: "OpenAI Responses (/v1/responses)", value: "openai-responses" },
  { label: "Azure OpenAI Responses", value: "azure-openai-responses" },
  { label: "OpenAI Codex Responses", value: "openai-codex-responses" },
  { label: "Anthropic Messages (/v1/messages)", value: "anthropic-messages" },
  { label: "Mistral Native Conversations", value: "mistral-conversations" },
  { label: "Google Generative AI (Gemini Studio)", value: "google-generative-ai" },
  { label: "Google Vertex AI", value: "google-vertex" },
  { label: "Amazon Bedrock Converse Stream", value: "bedrock-converse-stream" },
];

const thinkingFormatOptions: SelectOption[] = [
  { label: "Default (None)", value: "" },
  { label: "OpenAI / OpenRouter (reasoning: { effort })", value: "openai" },
  { label: "DeepSeek (reasoning_content)", value: "deepseek" },
  { label: "Qwen (enable_thinking: true)", value: "qwen" },
  { label: "Together (reasoning: { enabled })", value: "together" },
  { label: "String Thinking (<think>...</think>)", value: "string-thinking" },
];

function saveProvider() {
  const p = drawerStore.editingProvider;
  if (!p || !p.id.trim() || !p.baseUrl.trim()) {
    alert("请完整填写必填字段 (ID 与 Base URL)");
    return;
  }

  if (drawerStore.drawerType === "provider-add") {
    providerStore.addProvider(p);
  } else {
    providerStore.updateProvider(p);
  }

  drawerStore.closeDrawer();
}
</script>
