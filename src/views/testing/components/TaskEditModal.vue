<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none"
    @click.self="$emit('update:modelValue', false)"
  >
    <div class="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
      <!-- Modal Header -->
      <div class="px-5 py-4 border-b border-border/60 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 class="text-sm font-bold text-foreground">新建测试任务</h3>
        </div>

        <button
          type="button"
          class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          @click="$emit('update:modelValue', false)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto no-scrollbar">
        <!-- Task Name -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">任务名称</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="例如: 沙箱目录隔离验证测试"
            class="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>

        <!-- Task Category using Select.vue -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">分类场景</label>
          <Select
            v-model="form.category"
            :options="categoryOptions"
            placeholder="选择测试类别..."
            size="md"
          />
        </div>

        <!-- Task Description -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">任务描述</label>
          <input
            v-model="form.description"
            type="text"
            placeholder="简要说明本次测试的目的与关注指标"
            class="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>

        <!-- System Prompt -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">系统提示词 (可选)</label>
          <input
            v-model="form.systemPrompt"
            type="text"
            placeholder="例如: You are a helpful security assistant."
            class="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>

        <!-- User Prompt -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            用户测试用例 (User Prompt) <span class="text-destructive">*</span>
          </label>
          <textarea
            v-model="form.userPrompt"
            rows="3"
            placeholder="输入发送给 Pi Coding Agent 的测试提问或指令..."
            class="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-none"
          />
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-3.5 border-t border-border/60 bg-muted/30 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          @click="$emit('update:modelValue', false)"
        >
          取消
        </Button>
        <Button
          variant="primary"
          size="sm"
          :disabled="!form.name || !form.userPrompt"
          @click="handleSave"
        >
          创建任务
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import Button from "../../../components/ui/Button.vue";
import Select, { type SelectOption } from "../../../components/ui/Select.vue";
import { useTestingStore } from "../../../stores/testing.js";
import type { TaskCategory } from "../../../types/testing.js";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

const testingStore = useTestingStore();

const categoryOptions: SelectOption[] = [
  { label: "环境可用性自检 (Availability)", value: "availability" },
  { label: "深度推理思维链 (Reasoning)", value: "reasoning" },
  { label: "多工具链调用 (Tools)", value: "tools" },
  { label: "本地基准测速 (Speed)", value: "speed" },
  { label: "计划执行测试 (Plan Execution)", value: "plan-execution" },
  { label: "自定义测试场景 (Custom)", value: "custom" },
];

const form = reactive({
  name: "",
  category: "availability" as TaskCategory,
  description: "",
  systemPrompt: "",
  userPrompt: "",
});

function handleSave() {
  if (!form.name.trim() || !form.userPrompt.trim()) return;

  testingStore.addTask({
    name: form.name.trim(),
    category: form.category,
    description: form.description.trim() || "用户自定义测试任务",
    systemPrompt: form.systemPrompt.trim() || undefined,
    userPrompt: form.userPrompt.trim(),
  });

  // 重置表单并关闭
  form.name = "";
  form.category = "availability";
  form.description = "";
  form.systemPrompt = "";
  form.userPrompt = "";

  emit("update:modelValue", false);
}
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
