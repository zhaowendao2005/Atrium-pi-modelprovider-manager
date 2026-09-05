<template>
  <Sheet
    :model-value="drawerStore.isFieldDocOpen"
    :title="docInfo?.name || '配置字段详情'"
    :description="`字段标识：${docInfo?.field || drawerStore.activeDocField || '-'}`"
    :z-index="60"
    max-width-class="max-w-xl"
    @update:model-value="onOpenChange"
  >
    <div v-if="docInfo" class="flex flex-col gap-5 text-sm pb-4">
      <!-- 1. 当前模型在该字段下的真实生效配置 (Real Effective Status in Context) -->
      <div
        v-if="fieldEffectiveDetail"
        class="p-3.5 bg-gradient-to-br from-primary/10 via-primary/5 to-muted/20 border border-primary/25 rounded-2xl flex flex-col gap-2"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>当前模型真实生效值 (Effective Value)</span>
          </div>
          <span
            class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            :class="fieldEffectiveDetail.sourceBadgeClass"
          >
            {{ fieldEffectiveDetail.sourceBadgeText }}
          </span>
        </div>

        <!-- 真实值展示框 -->
        <div class="flex items-center justify-between p-2 rounded-xl bg-card border border-border text-xs font-mono">
          <span class="text-muted-foreground font-sans">实际生效：</span>
          <span class="font-semibold text-foreground truncate max-w-[280px]">
            {{ fieldEffectiveDetail.displayValue }}
          </span>
        </div>

        <div class="text-[11px] text-muted-foreground leading-relaxed flex items-center gap-1">
          <span>来源依据：</span>
          <span class="text-foreground">{{ fieldEffectiveDetail.sourceDescription }}</span>
        </div>
      </div>

      <!-- 2. 字段概述与作用 -->
      <div class="p-3.5 bg-muted/20 border border-border/60 rounded-xl flex flex-col gap-1.5">
        <div class="text-xs font-semibold text-foreground uppercase tracking-wider">
          字段概述
        </div>
        <p class="text-foreground/90 leading-relaxed text-xs">
          {{ docInfo.description }}
        </p>
      </div>

      <!-- 3. 工作机制与技术细节 -->
      <div v-if="docInfo.details" class="flex flex-col gap-2">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          工作机制与技术细节
        </h4>
        <div class="p-3 bg-muted/20 border border-border/60 rounded-xl text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
          {{ docInfo.details }}
        </div>
      </div>

      <!-- 4. 示例或常见取值 -->
      <div v-if="docInfo.example" class="flex flex-col gap-2">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          常见取值与配置示例
        </h4>
        <pre class="p-3 bg-slate-900 text-slate-100 rounded-xl border border-border text-xs font-mono overflow-x-auto leading-relaxed">{{ docInfo.example }}</pre>
      </div>

      <!-- 5. 影响与默认值卡片 -->
      <div class="grid grid-cols-1 gap-2.5 pt-2 border-t border-border/40">
        <div v-if="docInfo.impact" class="flex flex-col gap-1 text-xs">
          <span class="font-semibold text-foreground">💡 适用场景与问题解决：</span>
          <span class="text-muted-foreground">{{ docInfo.impact }}</span>
        </div>
        <div class="flex items-center justify-between text-xs py-1">
          <span class="text-muted-foreground">缺省 / 默认行为：</span>
          <span class="font-mono text-foreground font-medium">{{ docInfo.defaultValue || '继承提供商或系统默认' }}</span>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      <svg class="w-8 h-8 opacity-40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div class="text-xs">暂无该字段的详细文档说明</div>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDrawerStore } from "../../../../stores/windows/drawer.js";
import { useProviderStore } from "../../../../stores/provider.js";
import { fieldDocsMap } from "./fieldDocs.js";
import { resolveEffectiveModelConfig } from "../../../../utils/effective-config.js";
import Sheet from "../../../../components/ui/Sheet.vue";

const drawerStore = useDrawerStore();
const providerStore = useProviderStore();

const docInfo = computed(() => {
  const fieldKey = drawerStore.activeDocField;
  if (!fieldKey) return null;
  return fieldDocsMap[fieldKey] || null;
});

// 计算当前正在编辑的模型，在该特定字段上的真实生效值与继承来源
const fieldEffectiveDetail = computed(() => {
  const fieldKey = drawerStore.activeDocField;
  const model = drawerStore.editingModel;
  const targetProviderId = drawerStore.targetProviderId;
  if (!fieldKey || !model || !targetProviderId) return null;

  const provider = providerStore.providers.find((p) => p.id === targetProviderId) || {
    id: targetProviderId,
    baseUrl: "https://api.openai.com/v1",
    api: "openai-completions" as const,
  };

  const effective = resolveEffectiveModelConfig(provider, model);

  // 1. 基础通信与限制字段
  if (fieldKey === "id") {
    return {
      displayValue: effective.id,
      sourceBadgeText: "模型主键",
      sourceBadgeClass: "bg-primary/20 text-primary",
      sourceDescription: "传给上游请求体中的 model 字段",
    };
  }
  if (fieldKey === "name") {
    return {
      displayValue: effective.name,
      sourceBadgeText: model.name ? "模型显式覆盖" : "默认继承 ID",
      sourceBadgeClass: model.name ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground",
      sourceDescription: model.name ? "自定义显示名称" : `直接使用模型 ID (${effective.id}) 作为显示名称`,
    };
  }
  if (fieldKey === "family") {
    return {
      displayValue: effective.family,
      sourceBadgeText: "系列归属",
      sourceBadgeClass: "bg-primary/20 text-primary",
      sourceDescription: `归属 ${effective.family} 系列分组`,
    };
  }
  if (fieldKey === "api") {
    return {
      displayValue: effective.api.value,
      sourceBadgeText: effective.api.source === "model-override" ? "模型独立覆盖" : "继承提供商",
      sourceBadgeClass: effective.api.source === "model-override" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-primary/20 text-primary",
      sourceDescription: effective.api.sourceName || "-",
    };
  }
  if (fieldKey === "baseUrl") {
    return {
      displayValue: effective.baseUrl.value,
      sourceBadgeText: effective.baseUrl.source === "model-override" ? "模型独立覆盖" : "继承提供商",
      sourceBadgeClass: effective.baseUrl.source === "model-override" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-primary/20 text-primary",
      sourceDescription: effective.baseUrl.sourceName || "-",
    };
  }
  if (fieldKey === "input") {
    return {
      displayValue: JSON.stringify(effective.input.value),
      sourceBadgeText: effective.input.source === "model-override" ? "模型显式指定" : "系统默认",
      sourceBadgeClass: effective.input.source === "model-override" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground",
      sourceDescription: effective.input.sourceName || "-",
    };
  }
  if (fieldKey === "contextWindow") {
    return {
      displayValue: `${effective.contextWindow.value} Tokens (${effective.contextWindow.value / 1000}K)`,
      sourceBadgeText: effective.contextWindow.source === "model-override" ? "模型显式指定" : "默认 128K",
      sourceBadgeClass: effective.contextWindow.source === "model-override" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground",
      sourceDescription: effective.contextWindow.sourceName || "-",
    };
  }
  if (fieldKey === "maxTokens") {
    return {
      displayValue: `${effective.maxTokens.value} Tokens (${effective.maxTokens.value / 1000}K)`,
      sourceBadgeText: effective.maxTokens.source === "model-override" ? "模型显式指定" : "默认 16K",
      sourceBadgeClass: effective.maxTokens.source === "model-override" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground",
      sourceDescription: effective.maxTokens.sourceName || "-",
    };
  }
  if (fieldKey === "reasoning") {
    return {
      displayValue: effective.reasoning.value ? "已开启 (true)" : "已关闭 (false)",
      sourceBadgeText: "模型指定",
      sourceBadgeClass: effective.reasoning.value ? "bg-purple-500/20 text-purple-700 dark:text-purple-300" : "bg-muted text-muted-foreground",
      sourceDescription: effective.reasoning.sourceName || "-",
    };
  }
  if (fieldKey === "thinkingLevelMap") {
    const customCount = Object.keys(effective.thinkingLevelMap.value).length;
    return {
      displayValue: customCount > 0 ? `${customCount} 档位自定义` : "内置标准 7 档映射",
      sourceBadgeText: customCount > 0 ? "模型独立映射" : "系统默认",
      sourceBadgeClass: customCount > 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground",
      sourceDescription: effective.thinkingLevelMap.sourceName || "-",
    };
  }
  if (fieldKey === "cost") {
    const c = effective.cost.value;
    return {
      displayValue: `输入: $${c.input}/M · 输出: $${c.output}/M · 缓存读: $${c.cacheRead}/M · 缓存写: $${c.cacheWrite}/M`,
      sourceBadgeText: "模型费率",
      sourceBadgeClass: "bg-primary/20 text-primary",
      sourceDescription: "用于会话实时 Token 费用估算",
    };
  }
  if (fieldKey === "samplingParams") {
    const count = Object.keys(effective.samplingParams.value).length;
    return {
      displayValue: count > 0 ? JSON.stringify(effective.samplingParams.value) : "无附加根字段",
      sourceBadgeText: count > 0 ? "模型独立采样" : "无附加参数",
      sourceBadgeClass: count > 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground",
      sourceDescription: effective.samplingParams.sourceName || "-",
    };
  }
  if (fieldKey === "headers") {
    const count = Object.keys(effective.headers.merged).length;
    return {
      displayValue: count > 0 ? JSON.stringify(effective.headers.merged) : "无专属/附加请求头",
      sourceBadgeText: `合并后共 ${count} 项`,
      sourceBadgeClass: "bg-primary/20 text-primary",
      sourceDescription: `提供商 ${Object.keys(effective.headers.fromProvider).length} 项，模型专属覆盖 ${Object.keys(effective.headers.fromModel).length} 项`,
    };
  }

  // 2. Compat 字段检索
  const compatItem = effective.compatList.find((c) => c.key === fieldKey);
  if (compatItem) {
    const isModelOverride = compatItem.source === "model-override";
    const isInherited = compatItem.source === "provider-inherited";

    return {
      displayValue: compatItem.value === undefined ? "未配置 (undefined)" : String(compatItem.value),
      sourceBadgeText: isModelOverride ? "模型自身覆盖" : isInherited ? "继承提供商" : "系统默认缺省",
      sourceBadgeClass: isModelOverride
        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
        : isInherited
        ? "bg-primary/20 text-primary"
        : "bg-muted text-muted-foreground",
      sourceDescription: compatItem.sourceDescription,
    };
  }

  return null;
});

function onOpenChange(open: boolean) {
  if (!open) {
    drawerStore.closeFieldDoc();
  }
}
</script>

