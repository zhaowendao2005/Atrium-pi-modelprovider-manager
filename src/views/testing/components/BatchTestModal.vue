<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="drawerStore.isBatchTestModalOpen"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        @click.self="close"
      >
        <div class="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] select-none">
          <!-- Modal Header -->
          <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-card/60">
            <div>
              <h3 class="text-base font-bold text-foreground">批量发布多模型评测</h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                对当前任务「{{ testingStore.activeTask.name }}」选用多个模型执行横向对比测试
              </p>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              @click="close"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Body with AppleScrollArea -->
          <AppleScrollArea class="flex-1 px-6 py-4">
            <div class="flex flex-col gap-4">
              <!-- Select Stats & Quick Select -->
              <div class="flex items-center justify-between text-xs pb-1 border-b border-border/50">
                <span class="text-muted-foreground">
                  已勾选 <span class="font-bold text-primary">{{ selectedTargets.length }}</span> 个模型目标
                </span>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="text-xs text-primary hover:underline font-medium"
                    @click="selectAll"
                  >
                    全选全部
                  </button>
                  <span class="text-muted-foreground/40">|</span>
                  <button
                    type="button"
                    class="text-xs text-muted-foreground hover:text-foreground"
                    @click="clearAll"
                  >
                    清空
                  </button>
                </div>
              </div>

              <!-- Provider & Models Accordion List -->
              <div v-if="availableProviders.length === 0" class="py-12 text-center text-xs text-muted-foreground">
                暂无可用的提供商与模型，请先在「提供商管理」中添加并配置模型。
              </div>

              <div v-else class="flex flex-col gap-3">
                <div
                  v-for="provider in availableProviders"
                  :key="provider.id"
                  class="rounded-xl border border-border/60 bg-muted/30 overflow-hidden"
                >
                  <!-- Provider Header -->
                  <div class="px-3.5 py-2.5 bg-muted/60 flex items-center justify-between">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="text-xs font-semibold text-foreground truncate">{{ provider.name || provider.id }}</span>
                      <span class="text-[10px] px-1.5 py-0.2 rounded font-mono bg-card border border-border/60 text-muted-foreground">
                        {{ provider.models?.length || 0 }} 个模型
                      </span>
                    </div>

                    <button
                      type="button"
                      class="text-[11px] text-primary hover:underline"
                      @click="toggleSelectProvider(provider)"
                    >
                      {{ isProviderAllSelected(provider) ? '取消全选' : '全选该厂商' }}
                    </button>
                  </div>

                  <!-- Models Checklist -->
                  <div class="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      v-for="model in provider.models"
                      :key="model.id"
                      class="flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer"
                      :class="[
                        isSelected(provider.id, model.id)
                          ? 'bg-primary/10 border-primary/30 text-foreground'
                          : 'bg-card border-border/50 text-muted-foreground hover:bg-accent/50',
                      ]"
                    >
                      <input
                        type="checkbox"
                        :checked="isSelected(provider.id, model.id)"
                        class="rounded border-border text-primary focus:ring-primary/30"
                        @change="toggleModel(provider.id, provider.name || provider.id, model.id, model.name || model.id)"
                      />
                      <div class="min-w-0 flex-1">
                        <div class="text-xs font-medium truncate text-foreground">{{ model.name || model.id }}</div>
                        <div class="text-[10px] font-mono text-muted-foreground/70 truncate">{{ model.id }}</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </AppleScrollArea>

          <!-- Modal Footer -->
          <div class="px-6 py-3.5 border-t border-border bg-card/60 flex items-center justify-between">
            <span class="text-[11px] text-muted-foreground">
              每个模型均将在独立沙箱中依次执行并实时比对
            </span>

            <div class="flex items-center gap-2.5">
              <Button variant="outline" size="sm" @click="close">
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                :disabled="selectedTargets.length === 0"
                class="gap-1.5 font-semibold shadow-sm shadow-primary/20"
                @click="startBatch"
              >
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>启动评测 ({{ selectedTargets.length }})</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useTestingStore } from "../../../stores/testing.js";
import { useProviderStore } from "../../../stores/provider.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import AppleScrollArea from "../../../components/ui/AppleScrollArea.vue";
import Button from "../../../components/ui/Button.vue";
import type { BatchModelTarget } from "../../../types/testing.js";

const testingStore = useTestingStore();
const providerStore = useProviderStore();
const drawerStore = useDrawerStore();

const selectedTargets = ref<BatchModelTarget[]>([]);

const availableProviders = computed(() => {
  return providerStore.providers.filter((p) => p.models && p.models.length > 0);
});

function isSelected(providerId: string, modelId: string): boolean {
  return selectedTargets.value.some((t) => t.providerId === providerId && t.modelId === modelId);
}

function toggleModel(providerId: string, providerName: string, modelId: string, modelName: string) {
  const idx = selectedTargets.value.findIndex((t) => t.providerId === providerId && t.modelId === modelId);
  if (idx !== -1) {
    selectedTargets.value.splice(idx, 1);
  } else {
    selectedTargets.value.push({
      providerId,
      providerName,
      modelId,
      modelName,
    });
  }
}

function isProviderAllSelected(provider: any): boolean {
  if (!provider.models || provider.models.length === 0) return false;
  return provider.models.every((m: any) => isSelected(provider.id, m.id));
}

function toggleSelectProvider(provider: any) {
  if (isProviderAllSelected(provider)) {
    selectedTargets.value = selectedTargets.value.filter((t) => t.providerId !== provider.id);
  } else {
    for (const m of provider.models || []) {
      if (!isSelected(provider.id, m.id)) {
        selectedTargets.value.push({
          providerId: provider.id,
          providerName: provider.name || provider.id,
          modelId: m.id,
          modelName: m.name || m.id,
        });
      }
    }
  }
}

function selectAll() {
  const list: BatchModelTarget[] = [];
  for (const p of availableProviders.value) {
    for (const m of p.models || []) {
      list.push({
        providerId: p.id,
        providerName: p.name || p.id,
        modelId: m.id,
        modelName: m.name || m.id,
      });
    }
  }
  selectedTargets.value = list;
}

function clearAll() {
  selectedTargets.value = [];
}

function close() {
  drawerStore.closeBatchTestModal();
}

function startBatch() {
  if (selectedTargets.value.length === 0) return;
  testingStore.startBatchTest([...selectedTargets.value]);
  drawerStore.closeBatchTestModal();
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
