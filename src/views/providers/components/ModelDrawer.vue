<template>
  <Sheet
    :model-value="drawerStore.isOpen && (drawerStore.drawerType === 'model-add' || drawerStore.drawerType === 'model-edit')"
    :title="drawerStore.drawerType === 'model-add' ? '挂载新模型' : '编辑模型配置'"
    description="配置模型标识、模态输入、上下文上限、费率及思考推理能力"
    @update:model-value="val => { if (!val) drawerStore.closeDrawer() }"
  >
    <div v-if="drawerStore.editingModel" class="flex flex-col gap-5 text-sm">
      <!-- Basic Section -->
      <div class="flex flex-col gap-3.5">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          模型基础参数
        </h4>

        <!-- ID -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            模型 ID (上游 model 字段) <span class="text-destructive">*</span>
          </label>
          <Input
            v-model="drawerStore.editingModel.id"
            placeholder="例如: claude-3-7-sonnet-20250219 或 gpt-4o"
          />
        </div>

        <!-- Display Name -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            显示名称 (Display Name)
          </label>
          <Input
            v-model="drawerStore.editingModel.name"
            placeholder="例如: Claude 3.7 Sonnet"
          />
        </div>

        <!-- Family Select -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            模型系列归属 (Family)
          </label>
          <Select
            v-model="drawerStore.editingModel.family"
            :options="familyOptions"
          />
        </div>
      </div>

      <!-- Capability Section -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          多模态与推理能力
        </h4>

        <!-- Reasoning Switch -->
        <div class="flex items-center justify-between py-1">
          <div>
            <div class="font-medium text-xs text-foreground">支持推理思考 (Reasoning / CoT)</div>
            <div class="text-[11px] text-muted-foreground">支持思考链输出隔离与深度思考调节</div>
          </div>
          <Switch v-model="drawerStore.editingModel.reasoning" />
        </div>

        <!-- Vision Modality Switch -->
        <div class="flex items-center justify-between py-1">
          <div>
            <div class="font-medium text-xs text-foreground">支持图像视觉输入 (Vision / Multimodal)</div>
            <div class="text-[11px] text-muted-foreground">允许在 Prompt 中附加图片并进行多模态理解</div>
          </div>
          <Switch
            :model-value="hasVision"
            @update:model-value="toggleVision"
          />
        </div>
      </div>

      <!-- Limits Section -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          上下文与输出限制 (Tokens)
        </h4>

        <div class="grid grid-cols-2 gap-3">
          <!-- Context Window -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">
              上下文窗口 (Context Window)
            </label>
            <Input
              v-model="drawerStore.editingModel.contextWindow"
              type="number"
              placeholder="128000"
            />
          </div>

          <!-- Max Output Tokens -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">
              单次最大输出 (Max Tokens)
            </label>
            <Input
              v-model="drawerStore.editingModel.maxTokens"
              type="number"
              placeholder="16384"
            />
          </div>
        </div>
      </div>

      <!-- Cost Section -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          计费费率 ($ / 每百万 Tokens)
        </h4>

        <div v-if="drawerStore.editingModel.cost" class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">输入费率 (Input)</label>
            <Input v-model="drawerStore.editingModel.cost.input" type="number" placeholder="3.0" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">输出费率 (Output)</label>
            <Input v-model="drawerStore.editingModel.cost.output" type="number" placeholder="15.0" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">缓存命中读取 (Cache Read)</label>
            <Input v-model="drawerStore.editingModel.cost.cacheRead" type="number" placeholder="0.3" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">缓存写入 (Cache Write)</label>
            <Input v-model="drawerStore.editingModel.cost.cacheWrite" type="number" placeholder="3.75" />
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <Button variant="ghost" size="sm" @click="drawerStore.closeDrawer">
        取消
      </Button>
      <Button variant="primary" size="sm" @click="saveModel">
        保存模型
      </Button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import { useProviderStore } from "../../../stores/provider.js";
import Sheet from "../../../components/ui/Sheet.vue";
import Input from "../../../components/ui/Input.vue";
import Select, { type SelectOption } from "../../../components/ui/Select.vue";
import Switch from "../../../components/ui/Switch.vue";
import Button from "../../../components/ui/Button.vue";

const drawerStore = useDrawerStore();
const providerStore = useProviderStore();

const familyOptions: SelectOption[] = [
  { label: "Claude 系列", value: "Claude" },
  { label: "GPT / OpenAI 系列", value: "GPT" },
  { label: "DeepSeek 系列", value: "DeepSeek" },
  { label: "Qwen 通义千问系列", value: "Qwen" },
  { label: "Gemini 谷歌系列", value: "Gemini" },
  { label: "Mistral 系列", value: "Mistral" },
  { label: "Llama Meta 系列", value: "Llama" },
  { label: "其他自定义系列", value: "Other" },
];

const hasVision = computed(() => {
  return drawerStore.editingModel?.input?.includes("image") ?? false;
});

function toggleVision(val: boolean) {
  if (!drawerStore.editingModel) return;
  if (val) {
    drawerStore.editingModel.input = ["text", "image"];
  } else {
    drawerStore.editingModel.input = ["text"];
  }
}

function saveModel() {
  const m = drawerStore.editingModel;
  const providerId = drawerStore.targetProviderId;
  if (!m || !providerId || !m.id.trim()) {
    alert("请填写模型 ID");
    return;
  }

  // 格式化数字
  if (m.contextWindow) m.contextWindow = Number(m.contextWindow);
  if (m.maxTokens) m.maxTokens = Number(m.maxTokens);
  if (m.cost) {
    m.cost.input = Number(m.cost.input || 0);
    m.cost.output = Number(m.cost.output || 0);
    m.cost.cacheRead = Number(m.cost.cacheRead || 0);
    m.cost.cacheWrite = Number(m.cost.cacheWrite || 0);
  }

  if (drawerStore.drawerType === "model-add") {
    providerStore.addModel(providerId, m);
  } else {
    providerStore.updateModel(providerId, m);
  }

  drawerStore.closeDrawer();
}
</script>
