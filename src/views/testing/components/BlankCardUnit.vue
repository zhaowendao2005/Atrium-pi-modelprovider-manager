<template>
  <div
    class="flex flex-col h-full rounded-2xl border bg-card/80 backdrop-blur-xl overflow-hidden transition-all duration-200 shadow-sm relative select-none"
    :class="[
      isFocused
        ? 'border-primary/60 ring-2 ring-primary/20 shadow-md'
        : 'border-border/60 hover:border-border/90'
    ]"
    @click="focusCard"
  >
    <!-- Card Header -->
    <div class="px-4 py-2.5 border-b border-border/50 bg-muted/20 flex items-center justify-between gap-2 flex-shrink-0">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span
          class="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
          :class="[isFocused ? 'bg-primary' : 'bg-muted-foreground/40']"
        />
        <span class="text-xs font-bold text-foreground">
          空白卡片 · 槽位 #{{ slotIndex + 1 }}
        </span>
        <span class="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
          未绑定会话
        </span>
      </div>

      <!-- Right: Remove Slot Button -->
      <button
        v-if="canRemoveSlot"
        type="button"
        class="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        title="移除此空白卡片槽位"
        @click.stop="removeThisSlot"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Card Body: Fast In-Card Setup -->
    <div class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4 apple-scrollbar bg-background/20">
      <!-- Section 1: Target Model Selection -->
      <div class="flex flex-col gap-2">
        <label class="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-primary" />
          选择测试目标模型
        </label>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <!-- Provider Dropdown -->
          <div>
            <span class="text-[10px] text-muted-foreground mb-1 block">提供商 (Provider)</span>
            <Select
              v-model="selectedProviderId"
              :options="providerOptions"
              placeholder="选择提供商..."
              size="sm"
              :searchable="true"
            />
          </div>

          <!-- Model Dropdown -->
          <div>
            <span class="text-[10px] text-muted-foreground mb-1 block">模型 (Model)</span>
            <Select
              v-model="selectedModelId"
              :options="modelOptions"
              placeholder="选择模型..."
              size="sm"
              :searchable="true"
            />
          </div>
        </div>

        <!-- Capability Chips -->
        <div v-if="activeModelDetails" class="flex items-center gap-1.5 pt-1">
          <span
            v-if="activeModelDetails.reasoning"
            class="text-[9px] px-1.5 py-0.5 rounded font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
          >
            Reasoning
          </span>
          <span
            v-if="activeModelDetails.input?.includes('image')"
            class="text-[9px] px-1.5 py-0.5 rounded font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
          >
            Vision
          </span>
          <span
            v-if="activeModelDetails.contextWindow"
            class="text-[9px] px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground"
          >
            {{ Math.round(activeModelDetails.contextWindow / 1024) }}k
          </span>
        </div>
      </div>

      <!-- Section 2: Task Scenario Selection -->
      <div class="flex flex-col gap-2">
        <label class="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-primary" />
          测试任务场景
        </label>

        <Select
          v-model="selectedTaskId"
          :options="taskOptions"
          placeholder="选择测试场景..."
          size="sm"
        />

        <div v-if="activeTaskDetails" class="p-2.5 rounded-xl bg-muted/30 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
          <div class="font-semibold text-foreground mb-0.5">{{ activeTaskDetails.name }}</div>
          <div>{{ activeTaskDetails.description }}</div>
        </div>
      </div>

      <!-- Section 3: History Projection Tip -->
      <div class="p-3 rounded-xl border border-dashed border-border/70 bg-muted/10 text-center flex flex-col items-center justify-center gap-1 mt-auto">
        <div class="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>快速载入历史</span>
        </div>
        <p class="text-[10px] text-muted-foreground">
          聚焦当前卡片时，点击左侧历史记录列表中的任意会话即可直接置入此卡片。
        </p>
      </div>
    </div>

    <!-- Card Footer: Execution Actions -->
    <div class="p-3 border-t border-border/50 bg-card/90 backdrop-blur-md flex items-center justify-between gap-2 flex-shrink-0">
      <div class="flex items-center gap-2">
        <!-- Start Test Button -->
        <button
          type="button"
          class="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          :disabled="!selectedProviderId || !selectedModelId"
          @click.stop="bindAndStart"
        >
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>创建并执行</span>
        </button>

        <!-- Create Draft Only Button -->
        <button
          type="button"
          class="px-3 py-1.5 rounded-xl border border-border/60 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
          :disabled="!selectedProviderId || !selectedModelId"
          @click.stop="bindDraftOnly"
        >
          仅创建草稿
        </button>
      </div>

      <!-- Launcher Modal Shortcut -->
      <button
        type="button"
        class="text-[11px] text-primary hover:underline"
        @click.stop="drawerStore.openLauncherModal()"
      >
        使用发起向导
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useTestingStore } from "../../../stores/testing.js";
import { useProviderStore } from "../../../stores/provider.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import Select from "../../../components/ui/Select.vue";
import type { ModelSchema } from "../../../types/index.js";

const props = defineProps<{
  slotIndex: number;
}>();

const testingStore = useTestingStore();
const providerStore = useProviderStore();
const drawerStore = useDrawerStore();

const isFocused = computed(() => testingStore.focusedSlotIndex === props.slotIndex);

const canRemoveSlot = computed(() => {
  return (
    testingStore.layoutMode === "multi-col" ||
    testingStore.layoutMode === "two-row-multi-col" ||
    testingStore.activeSlotSessionIds.length > 1
  );
});

const selectedProviderId = ref(providerStore.activeProvider?.id || providerStore.providers[0]?.id || "");
const selectedModelId = ref("");
const selectedTaskId = ref(testingStore.activeTaskId || testingStore.tasks[0]?.id || "01_speed_and_stream");

const providerOptions = computed(() => {
  return providerStore.providers.map((p) => ({
    value: p.id,
    label: p.name || p.id,
  }));
});

const currentProvider = computed(() => {
  return providerStore.providers.find((p) => p.id === selectedProviderId.value);
});

const modelOptions = computed(() => {
  if (!currentProvider.value?.models) return [];
  return currentProvider.value.models.map((m) => ({
    value: m.id,
    label: m.name || m.id,
  }));
});

const activeModelDetails = computed<ModelSchema | null>(() => {
  if (!currentProvider.value?.models) return null;
  return currentProvider.value.models.find((m) => m.id === selectedModelId.value) || null;
});

const taskOptions = computed(() => {
  return testingStore.tasks.map((t) => ({
    value: t.id,
    label: t.name,
  }));
});

const activeTaskDetails = computed(() => {
  return testingStore.tasks.find((t) => t.id === selectedTaskId.value) || null;
});

watch(
  () => selectedProviderId.value,
  (pId) => {
    const p = providerStore.providers.find((x) => x.id === pId);
    if (p?.models?.[0]) {
      selectedModelId.value = p.models[0].id;
    } else {
      selectedModelId.value = "";
    }
  },
  { immediate: true }
);

function focusCard() {
  testingStore.setFocusedSlot(props.slotIndex);
}

function removeThisSlot() {
  testingStore.removeSlot(props.slotIndex);
}

function bindDraftOnly() {
  if (!selectedProviderId.value || !selectedModelId.value) return;
  const newSession = testingStore.createSession({
    taskId: selectedTaskId.value,
    providerId: selectedProviderId.value,
    modelId: selectedModelId.value,
    slotIndex: props.slotIndex,
  });
  testingStore.activeSlotSessionIds[props.slotIndex] = newSession.id;
}

async function bindAndStart() {
  if (!selectedProviderId.value || !selectedModelId.value) return;
  const newSession = testingStore.createSession({
    taskId: selectedTaskId.value,
    providerId: selectedProviderId.value,
    modelId: selectedModelId.value,
    slotIndex: props.slotIndex,
  });
  testingStore.activeSlotSessionIds[props.slotIndex] = newSession.id;
  await testingStore.startSession(newSession.id);
}
</script>
