<template>
  <Sheet
    :model-value="drawerStore.isOpen && (drawerStore.drawerType === 'model-add' || drawerStore.drawerType === 'model-edit')"
    :title="drawerStore.drawerType === 'model-add' ? '挂载新模型' : '编辑模型配置'"
    description="配置模型标识、协议覆盖、采样参数、7 档推理映射与阶梯计费"
    @update:model-value="val => { if (!val) drawerStore.closeDrawer() }"
  >
    <div v-if="drawerStore.editingModel" class="flex flex-col gap-5 text-sm">
      <!-- Top Preset Bar (当前提供商专属模型预设宏选择与状态提示) -->
      <div class="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-primary/5 to-transparent border border-purple-500/20 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <!-- Sparkles SVG -->
            <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>模型预设模版 (当前提供商作用域)</span>
          </div>

          <!-- Status Indicator -->
          <div class="flex items-center gap-1.5 text-[11px]">
            <span
              v-if="drawerStore.editingModel.appliedPreset && drawerStore.editingModel.appliedPreset !== 'custom'"
              class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium truncate max-w-[160px]"
              :title="`已套用: ${drawerStore.editingModel.appliedPreset}`"
            >
              已套用: {{ drawerStore.editingModel.appliedPreset }}
            </span>
            <span
              v-else-if="drawerStore.editingModel.appliedPreset === 'custom'"
              class="px-2 py-0.5 rounded-full bg-slate-500/15 text-muted-foreground font-medium"
            >
              自定义已修改 (Custom)
            </span>
            <span
              v-if="providerStore.autoSaveStatus === 'saving'"
              class="flex items-center gap-1 text-muted-foreground animate-pulse"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>保存中...</span>
            </span>
            <span
              v-else-if="providerStore.autoSaveStatus === 'saved'"
              class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>已自动保存</span>
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Select
            :model-value="selectedModelPresetId"
            :options="modelPresetOptions"
            @update:model-value="onApplyModelPresetChange"
          />
        </div>
      </div>

      <!-- Basic Section -->
      <div class="flex flex-col gap-3.5">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          模型基础参数
        </h4>

        <!-- ID with Real-Time Best Match Hint -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            模型 ID (传给上游的 model 字段) <span class="text-destructive">*</span>
          </label>
          <Input
            v-model="drawerStore.editingModel.id"
            placeholder="例如: claude-3-7-sonnet-20250219 或 gpt-4o"
            @blur="handleAutoSave"
            @input="onModelIdInput"
          />

          <!-- Real-Time Fuzzy Best Match Suggestion Bar (实时模糊相近推荐) -->
          <div
            v-if="suggestedPresetModel"
            class="mt-1 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between gap-2 transition-all animate-fadeIn"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-purple-600 dark:text-purple-400 flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <div class="flex flex-col min-w-0">
                <div class="text-xs font-semibold text-foreground truncate">
                  匹配官方预设: {{ suggestedPresetModel.name || suggestedPresetModel.id }}
                </div>
                <div class="text-[10px] text-muted-foreground truncate">
                  上下文 {{ (suggestedPresetModel.contextWindow || 128000) / 1000 }}K · 单次输出 {{ (suggestedPresetModel.maxTokens || 16384) / 1000 }}K
                </div>
              </div>
            </div>

            <button
              type="button"
              class="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
              @click="applySuggestedPreset"
            >
              一键套用
            </button>
          </div>
        </div>

        <!-- Display Name -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            显示名称 (Display Name)
          </label>
          <Input
            v-model="drawerStore.editingModel.name"
            placeholder="例如: Claude 3.7 Sonnet"
            @blur="handleAutoSave"
            @input="onFieldModified"
          />
        </div>

        <!-- Family Select -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            模型系列归属 (Family 分组)
          </label>
          <Select
            v-model="drawerStore.editingModel.family"
            :options="familyOptions"
            @change="() => { onFieldModified(); handleAutoSave(); }"
          />
        </div>
      </div>

      <!-- Capability Section -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          多模态与推理能力
        </h4>

        <!-- Vision Modality Switch -->
        <div class="flex items-center justify-between py-1">
          <div>
            <div class="font-medium text-xs text-foreground">支持图像视觉输入 (Vision / Multimodal)</div>
            <div class="text-[11px] text-muted-foreground">允许在 Prompt 中附加图片进行视觉理解 (input: ["text", "image"])</div>
          </div>
          <Switch
            :model-value="hasVision"
            @update:model-value="toggleVision"
          />
        </div>

        <!-- Reasoning Switch -->
        <div class="flex items-center justify-between py-1">
          <div>
            <div class="font-medium text-xs text-foreground">支持推理思考 (Reasoning / CoT)</div>
            <div class="text-[11px] text-muted-foreground">支持思考链输出隔离与深度思考调节</div>
          </div>
          <Switch v-model="drawerStore.editingModel.reasoning" />
        </div>

        <!-- Thinking Level Map (7 Levels, available when reasoning is enabled) -->
        <div v-if="drawerStore.editingModel.reasoning" class="flex flex-col gap-2.5 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
          <div class="flex items-center justify-between">
            <div class="font-medium text-xs text-purple-700 dark:text-purple-300">
              7 档推理思考强度映射 (thinkingLevelMap)
            </div>
            <button
              type="button"
              class="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              @click="showThinkingMap = !showThinkingMap"
            >
              <span>{{ showThinkingMap ? '收起映射表' : '展开精细映射' }}</span>
              <svg
                class="w-3.5 h-3.5 transition-transform duration-200"
                :class="{ 'rotate-180': showThinkingMap }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <p class="text-[11px] text-muted-foreground">
            精细化配置 Pi 标准档位与上游参数的转换（可屏蔽不支持的档位，如在 UI 隐藏）
          </p>

          <div v-if="showThinkingMap" class="flex flex-col gap-2 pt-1">
            <div
              v-for="lvl in THINKING_LEVELS"
              :key="lvl.key"
              class="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border/60 text-xs"
            >
              <div class="w-32 flex-shrink-0">
                <span class="font-medium text-foreground">{{ lvl.label }}</span>
                <span class="block text-[10px] font-mono text-muted-foreground">{{ lvl.key }}</span>
              </div>

              <!-- Mapping Type Selector -->
              <div class="flex items-center gap-2 flex-1 justify-end">
                <Select
                  size="sm"
                  class="w-36"
                  :model-value="getThinkingLevelMode(lvl.key)"
                  :options="thinkingLevelModeOptions"
                  @update:model-value="val => onThinkingLevelModeChange(lvl.key, val)"
                />

                <input
                  v-if="getThinkingLevelMode(lvl.key) === 'custom'"
                  type="text"
                  placeholder="上游参数 (如 default / max)"
                  class="w-36 bg-slate-100 dark:bg-slate-800 border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  :value="getThinkingLevelCustomVal(lvl.key)"
                  @input="onThinkingLevelCustomValInput(lvl.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
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

      <!-- Cost Section (Base + Tiers) -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            计费费率 ($ / 每百万 Tokens)
          </h4>
          <button
            type="button"
            class="text-[11px] text-primary hover:underline flex items-center gap-1"
            @click="showCostTiers = !showCostTiers"
          >
            <span>{{ showCostTiers ? '收起阶梯费率' : '阶梯定价 (Tiers)' }}</span>
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="{ 'rotate-180': showCostTiers }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div v-if="drawerStore.editingModel.cost" class="flex flex-col gap-3">
          <div class="grid grid-cols-2 gap-3">
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

          <!-- Tiered Pricing Section -->
          <div v-if="showCostTiers" class="flex flex-col gap-2 pt-2 border-t border-border/60 bg-muted/20 p-3 rounded-xl">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-foreground">超长上下文阶梯定价</span>
              <button
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 border border-primary/20 transition-colors"
                @click="addCostTier"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>添加阶梯档位</span>
              </button>
            </div>

            <div v-if="!drawerStore.editingModel.cost.tiers || drawerStore.editingModel.cost.tiers.length === 0" class="text-center py-2 text-xs text-muted-foreground">
              暂未配置阶梯费率
            </div>

            <div
              v-for="(tier, tIdx) in drawerStore.editingModel.cost.tiers"
              :key="tIdx"
              class="flex flex-col gap-2 p-3 bg-card border border-border/70 rounded-xl"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <span>当输入 Tokens 超过:</span>
                  <input
                    v-model.number="tier.inputTokensAbove"
                    type="number"
                    placeholder="200000"
                    class="w-24 bg-slate-100 dark:bg-slate-800 border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground"
                  />
                  <span>时生效</span>
                </div>
                <button
                  type="button"
                  title="删除该阶梯"
                  class="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  @click="removeCostTier(tIdx)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div class="grid grid-cols-4 gap-2 pt-1">
                <div>
                  <label class="text-[10px] text-muted-foreground block">输入 (Input)</label>
                  <input v-model.number="tier.input" type="number" class="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-lg px-2 py-1 text-xs" />
                </div>
                <div>
                  <label class="text-[10px] text-muted-foreground block">输出 (Output)</label>
                  <input v-model.number="tier.output" type="number" class="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-lg px-2 py-1 text-xs" />
                </div>
                <div>
                  <label class="text-[10px] text-muted-foreground block">缓存读 (CacheRead)</label>
                  <input v-model.number="tier.cacheRead" type="number" class="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-lg px-2 py-1 text-xs" />
                </div>
                <div>
                  <label class="text-[10px] text-muted-foreground block">缓存写 (CacheWrite)</label>
                  <input v-model.number="tier.cacheWrite" type="number" class="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-lg px-2 py-1 text-xs" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section: Endpoint & Protocol Override (局部覆盖 Provider) -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            协议与端点局部覆盖 (Override)
          </h4>
          <button
            type="button"
            class="text-[11px] text-primary hover:underline flex items-center gap-1"
            @click="showOverrides = !showOverrides"
          >
            <span>{{ showOverrides ? '收起局部覆盖' : '展开覆盖设置' }}</span>
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="{ 'rotate-180': showOverrides }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div v-if="showOverrides" class="flex flex-col gap-3 bg-muted/20 p-3 rounded-xl">
          <p class="text-[11px] text-muted-foreground">
            用于该模型需要绕过提供商默认协议路由（例如中转站下特定 Claude 模型走 anthropic 原生流式通道）
          </p>

          <!-- Override API Protocol -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-foreground">覆盖底层通信协议 (api)</label>
              <button
                v-if="drawerStore.editingModel.api"
                type="button"
                class="text-[10px] text-muted-foreground hover:text-foreground"
                @click="drawerStore.editingModel.api = undefined"
              >
                重置为继承
              </button>
            </div>
            <Select
              :model-value="drawerStore.editingModel.api || ''"
              :options="protocolOverrideOptions"
              @update:model-value="val => drawerStore.editingModel!.api = (val as any) || undefined"
            />
          </div>

          <!-- Override Base URL -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">覆盖 Base URL 端点 (baseUrl)</label>
            <Input
              v-model="drawerStore.editingModel.baseUrl"
              placeholder="留空则继承提供商 Base URL"
            />
          </div>

          <!-- Override Headers -->
          <div class="flex flex-col gap-1.5 pt-1">
            <label class="text-xs font-medium text-foreground">模型专属附加 Headers (与全局合并)</label>
            <KeyValueEditor
              v-model="drawerStore.editingModel.headers"
              key-placeholder="Header 名称"
              value-placeholder="Header 值"
              add-button-text="添加专属 Header"
              empty-text="无专属 Header (继承提供商)"
            />
          </div>
        </div>
      </div>

      <!-- Section: Sampling Parameters (samplingParams) -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            采样参数注入 (samplingParams)
          </h4>
          <button
            type="button"
            class="text-[11px] text-primary hover:underline flex items-center gap-1"
            @click="showSamplingParams = !showSamplingParams"
          >
            <span>{{ showSamplingParams ? '收起采样参数' : '配置采样参数' }}</span>
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="{ 'rotate-180': showSamplingParams }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div v-if="showSamplingParams" class="flex flex-col gap-3 bg-muted/20 p-3 rounded-xl">
          <p class="text-[11px] text-muted-foreground">
            原样（verbatim）覆盖合并到发送给后端的请求体根节点 JSON 中
          </p>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-foreground">Temperature (温度)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="2"
                placeholder="例如: 0.7 (留空不发送)"
                class="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none"
                :value="getSamplingParam('temperature')"
                @input="setSamplingParam('temperature', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-foreground">Top P (核采样)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                placeholder="例如: 0.95"
                class="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none"
                :value="getSamplingParam('top_p')"
                @input="setSamplingParam('top_p', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-foreground">Top K</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="例如: 40"
                class="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none"
                :value="getSamplingParam('top_k')"
                @input="setSamplingParam('top_k', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-foreground">Presence Penalty</label>
              <input
                type="number"
                step="0.1"
                placeholder="例如: 0.2"
                class="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none"
                :value="getSamplingParam('presence_penalty')"
                @input="setSamplingParam('presence_penalty', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <!-- Custom verbatim sampling params -->
          <div class="flex flex-col gap-1.5 pt-1">
            <label class="text-xs font-medium text-foreground">其他自定义请求体根字段</label>
            <KeyValueEditor
              v-model="customSamplingParamsStr"
              key-placeholder="参数名 (如 min_p)"
              value-placeholder="参数值"
              add-button-text="添加请求体参数"
              empty-text="无其他自定义参数"
            />
          </div>
        </div>
      </div>

      <!-- Section: Model Compat Override -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            模型级兼容性覆盖 (Model Compat)
          </h4>
          <button
            type="button"
            class="text-[11px] text-primary hover:underline flex items-center gap-1"
            @click="showModelCompat = !showModelCompat"
          >
            <span>{{ showModelCompat ? '收起兼容覆盖' : '配置兼容覆盖' }}</span>
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="{ 'rotate-180': showModelCompat }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div v-if="showModelCompat" class="flex flex-col gap-3 bg-muted/20 p-3 rounded-xl">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">独立思考链传递格式 (thinkingFormat)</label>
            <Select
              :model-value="drawerStore.editingModel.compat?.thinkingFormat || ''"
              :options="modelThinkingFormatOptions"
              @update:model-value="onModelThinkingFormatChange"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">最大 Token 字段覆盖 (maxTokensField)</label>
            <Select
              :model-value="drawerStore.editingModel.compat?.maxTokensField || ''"
              :options="modelMaxTokensFieldOptions"
              @update:model-value="val => onModelCompatFieldChange('maxTokensField', val)"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">思考预算字段 (thinkingTokenBudgetField)</label>
            <Select
              :model-value="drawerStore.editingModel.compat?.thinkingTokenBudgetField || ''"
              :options="modelThinkingTokenBudgetOptions"
              @update:model-value="val => onModelCompatFieldChange('thinkingTokenBudgetField', val)"
            />
          </div>

          <!-- Model-level Tri-state Switches (Inherit / True / False) -->
          <div class="flex flex-col gap-2 pt-2 border-t border-border/40">
            <div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              细粒度特性开关覆盖 (留空即继承提供商)
            </div>

            <div class="flex items-center justify-between py-1 text-xs">
              <span>Developer 角色 (supportsDeveloperRole)</span>
              <Select
                size="sm"
                class="w-32"
                :model-value="getTriStateMode('supportsDeveloperRole')"
                :options="triStateSelectOptions"
                @update:model-value="val => setTriStateMode('supportsDeveloperRole', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1 text-xs">
              <span>Reasoning Effort 传递 (supportsReasoningEffort)</span>
              <Select
                size="sm"
                class="w-32"
                :model-value="getTriStateMode('supportsReasoningEffort')"
                :options="triStateSelectOptions"
                @update:model-value="val => setTriStateMode('supportsReasoningEffort', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1 text-xs">
              <span>自适应思考 (forceAdaptiveThinking)</span>
              <Select
                size="sm"
                class="w-32"
                :model-value="getTriStateMode('forceAdaptiveThinking')"
                :options="triStateSelectOptions"
                @update:model-value="val => setTriStateMode('forceAdaptiveThinking', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1 text-xs">
              <span>允许空思考签名 (allowEmptySignature)</span>
              <Select
                size="sm"
                class="w-32"
                :model-value="getTriStateMode('allowEmptySignature')"
                :options="triStateSelectOptions"
                @update:model-value="val => setTriStateMode('allowEmptySignature', val)"
              />
            </div>

            <!-- New GPT-5.4 / GPT-5.6 Tri-state Switches -->
            <div class="flex items-center justify-between py-1 text-xs">
              <span>显式提示词缓存 (supportsExplicitPromptCacheMode)</span>
              <Select
                size="sm"
                class="w-32"
                :model-value="getTriStateMode('supportsExplicitPromptCacheMode')"
                :options="triStateSelectOptions"
                @update:model-value="val => setTriStateMode('supportsExplicitPromptCacheMode', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1 text-xs">
              <span>扩展附加工具 (supportsAdditionalTools)</span>
              <Select
                size="sm"
                class="w-32"
                :model-value="getTriStateMode('supportsAdditionalTools')"
                :options="triStateSelectOptions"
                @update:model-value="val => setTriStateMode('supportsAdditionalTools', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1 text-xs">
              <span>内置工具搜索 (supportsToolSearch)</span>
              <Select
                size="sm"
                class="w-32"
                :model-value="getTriStateMode('supportsToolSearch')"
                :options="triStateSelectOptions"
                @update:model-value="val => setTriStateMode('supportsToolSearch', val)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { ThinkingLevel, ModelSchema } from "../../../types/index.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import { useProviderStore } from "../../../stores/provider.js";
import { usePresetsStore } from "../../../stores/presets.js";
import Sheet from "../../../components/ui/Sheet.vue";
import Input from "../../../components/ui/Input.vue";
import Select, { type SelectOption } from "../../../components/ui/Select.vue";
import Switch from "../../../components/ui/Switch.vue";
import KeyValueEditor from "../../../components/ui/KeyValueEditor.vue";

const drawerStore = useDrawerStore();
const providerStore = useProviderStore();
const presetsStore = usePresetsStore();

const showThinkingMap = ref(false);
const showCostTiers = ref(false);
const showOverrides = ref(false);
const showSamplingParams = ref(false);
const showModelCompat = ref(false);

const suggestedPresetModel = ref<ModelSchema | null>(null);

const currentProviderPresets = computed(() => {
  const pid = drawerStore.targetProviderId;
  if (!pid) return null;
  return presetsStore.providerCache.get(pid.toLowerCase()) || null;
});

// 当抽屉打开时，按需懒加载当前 Provider 作用域内的模型预设
watch(
  () => drawerStore.targetProviderId,
  (newPid) => {
    if (newPid) {
      presetsStore.getProviderPreset(newPid);
    }
  },
  { immediate: true }
);

const modelPresetOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = [{ label: "从当前提供商预设库选择套用...", value: "" }];
  const details = currentProviderPresets.value;
  if (details && details.models) {
    for (const m of details.models) {
      options.push({
        label: `${m.name || m.id} (${(m.contextWindow || 128000) / 1000}K)`,
        value: m.id,
      });
    }
  }
  return options;
});

const selectedModelPresetId = computed(() => {
  return drawerStore.editingModel?.appliedPreset === "custom"
    ? ""
    : (drawerStore.editingModel?.appliedPreset || "");
});

async function onModelIdInput() {
  onFieldModified();
  const mid = drawerStore.editingModel?.id;
  const pid = drawerStore.targetProviderId;
  if (!mid || !pid || mid.length < 2) {
    suggestedPresetModel.value = null;
    return;
  }
  const match = await presetsStore.findBestMatchInProvider(pid, mid);
  if (match && match.id !== mid) {
    suggestedPresetModel.value = match;
  } else {
    suggestedPresetModel.value = null;
  }
}

function applySuggestedPreset() {
  if (!suggestedPresetModel.value || !drawerStore.editingModel) return;
  presetsStore.applyModelPreset(drawerStore.editingModel, suggestedPresetModel.value);
  suggestedPresetModel.value = null;
  handleAutoSave();
}

async function onApplyModelPresetChange(modelId: string) {
  if (!modelId || !drawerStore.editingModel || !drawerStore.targetProviderId) return;
  const details = await presetsStore.getProviderPreset(drawerStore.targetProviderId);
  const found = details?.models.find((m) => m.id === modelId);
  if (found) {
    presetsStore.applyModelPreset(drawerStore.editingModel, found);
    suggestedPresetModel.value = null;
    handleAutoSave();
  }
}

function onFieldModified() {
  if (drawerStore.editingModel && drawerStore.editingModel.appliedPreset) {
    drawerStore.editingModel.appliedPreset = "custom";
  }
}

function handleAutoSave() {
  const m = drawerStore.editingModel;
  const providerId = drawerStore.targetProviderId;
  if (!m || !providerId || !m.id.trim()) return;

  // 格式化数字
  if (m.contextWindow) m.contextWindow = Number(m.contextWindow);
  if (m.maxTokens) m.maxTokens = Number(m.maxTokens);
  if (m.cost) {
    m.cost.input = Number(m.cost.input || 0);
    m.cost.output = Number(m.cost.output || 0);
    m.cost.cacheRead = Number(m.cost.cacheRead || 0);
    m.cost.cacheWrite = Number(m.cost.cacheWrite || 0);
    if (m.cost.tiers) {
      for (const t of m.cost.tiers) {
        t.inputTokensAbove = Number(t.inputTokensAbove || 0);
        t.input = Number(t.input || 0);
        t.output = Number(t.output || 0);
        t.cacheRead = Number(t.cacheRead || 0);
        t.cacheWrite = Number(t.cacheWrite || 0);
      }
    }
  }

  // 清除空字面量
  if (m.api === ("" as any)) delete m.api;
  if (m.baseUrl && !m.baseUrl.trim()) delete m.baseUrl;
  if (m.headers && Object.keys(m.headers).length === 0) delete m.headers;
  if (m.samplingParams && Object.keys(m.samplingParams).length === 0) delete m.samplingParams;
  if (m.thinkingLevelMap && Object.keys(m.thinkingLevelMap).length === 0) delete m.thinkingLevelMap;
  if (m.compat && Object.keys(m.compat).length === 0) delete m.compat;

  if (drawerStore.drawerType === "model-add") {
    const p = providerStore.providers.find((item) => item.id === providerId);
    const exists = p?.models?.find((item) => item.id === m.id);
    if (!exists) {
      providerStore.addModel(providerId, m);
      drawerStore.drawerType = "model-edit";
    } else {
      providerStore.updateModel(providerId, m);
    }
  } else {
    providerStore.updateModel(providerId, m);
  }
}

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

const protocolOverrideOptions: SelectOption[] = [
  { label: "继承提供商默认协议", value: "" },
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

const THINKING_LEVELS: Array<{ key: ThinkingLevel; label: string }> = [
  { key: "off", label: "关闭思考 (off)" },
  { key: "minimal", label: "极简思考 (minimal)" },
  { key: "low", label: "浅度思考 (low)" },
  { key: "medium", label: "中度思考 (medium)" },
  { key: "high", label: "高度思考 (high)" },
  { key: "xhigh", label: "超强思考 (xhigh)" },
  { key: "max", label: "最大思考 (max)" },
];

const modelThinkingFormatOptions: SelectOption[] = [
  { label: "继承提供商格式", value: "" },
  { label: "OpenAI (reasoning: { effort })", value: "openai" },
  { label: "OpenRouter 原生格式", value: "openrouter" },
  { label: "DeepSeek (reasoning_content)", value: "deepseek" },
  { label: "Qwen 通义千问 (enable_thinking: true)", value: "qwen" },
  { label: "Together AI (reasoning: { enabled })", value: "together" },
  { label: "Baseten (chat_template_args)", value: "baseten" },
  { label: "智谱 Zhipu AI (reasoning_content)", value: "zai" },
  { label: "Chat Template (chat_template_kwargs)", value: "chat-template" },
  { label: "Qwen Chat Template", value: "qwen-chat-template" },
  { label: "String Thinking (<think>...</think>)", value: "string-thinking" },
  { label: "蚂蚁百灵 Ant Ling 格式", value: "ant-ling" },
];

const modelMaxTokensFieldOptions: SelectOption[] = [
  { label: "继承提供商设置", value: "" },
  { label: "max_completion_tokens (OpenAI 新规范)", value: "max_completion_tokens" },
  { label: "max_tokens (传统中转兼容)", value: "max_tokens" },
];

const modelThinkingTokenBudgetOptions: SelectOption[] = [
  { label: "继承提供商设置", value: "" },
  { label: "thinking_token_budget (vLLM)", value: "thinking_token_budget" },
  { label: "thinking_budget (Qwen / DashScope / SGLang)", value: "thinking_budget" },
  { label: "thinking_budget_tokens (llama.cpp)", value: "thinking_budget_tokens" },
];

const thinkingLevelModeOptions: SelectOption[] = [
  { label: "默认 / 透传", value: "inherit" },
  { label: "指定映射值", value: "custom" },
  { label: "禁用此档位 (null)", value: "disabled" },
];

const triStateSelectOptions: SelectOption[] = [
  { label: "继承提供商", value: "inherit" },
  { label: "开启 (true)", value: "true" },
  { label: "关闭 (false)", value: "false" },
];

function onModelCompatFieldChange(field: string, val: unknown) {
  if (!drawerStore.editingModel) return;
  if (!drawerStore.editingModel.compat) {
    drawerStore.editingModel.compat = {};
  }
  if (!val) {
    delete (drawerStore.editingModel.compat as any)[field];
  } else {
    (drawerStore.editingModel.compat as any)[field] = val;
  }
  onFieldModified();
  handleAutoSave();
}

function getTriStateMode(field: string): "inherit" | "true" | "false" {
  const compat = drawerStore.editingModel?.compat;
  if (!compat || (compat as any)[field] === undefined) return "inherit";
  return (compat as any)[field] === true ? "true" : "false";
}

function setTriStateMode(field: string, val: string) {
  if (!drawerStore.editingModel) return;
  if (!drawerStore.editingModel.compat) {
    drawerStore.editingModel.compat = {};
  }
  if (val === "inherit") {
    delete (drawerStore.editingModel.compat as any)[field];
  } else {
    (drawerStore.editingModel.compat as any)[field] = val === "true";
  }
  onFieldModified();
  handleAutoSave();
}

const hasVision = computed(() => {
  const input = drawerStore.editingModel?.input || [];
  return input.includes("image");
});

function toggleVision(val: boolean) {
  if (!drawerStore.editingModel) return;
  if (val) {
    drawerStore.editingModel.input = ["text", "image"];
  } else {
    drawerStore.editingModel.input = ["text"];
  }
  onFieldModified();
  handleAutoSave();
}

// === Thinking Level Map Helpers ===
function getThinkingLevelMode(key: ThinkingLevel): "inherit" | "custom" | "disabled" {
  const map = drawerStore.editingModel?.thinkingLevelMap;
  if (!map || map[key] === undefined) return "inherit";
  if (map[key] === null) return "disabled";
  return "custom";
}

function getThinkingLevelCustomVal(key: ThinkingLevel): string {
  const map = drawerStore.editingModel?.thinkingLevelMap;
  if (!map || map[key] === undefined || map[key] === null) return "";
  return String(map[key]);
}

function onThinkingLevelModeChange(key: ThinkingLevel, mode: string) {
  if (!drawerStore.editingModel) return;
  if (!drawerStore.editingModel.thinkingLevelMap) {
    drawerStore.editingModel.thinkingLevelMap = {};
  }
  if (mode === "inherit") {
    delete drawerStore.editingModel.thinkingLevelMap[key];
  } else if (mode === "disabled") {
    drawerStore.editingModel.thinkingLevelMap[key] = null;
  } else {
    drawerStore.editingModel.thinkingLevelMap[key] = "default";
  }
  onFieldModified();
  handleAutoSave();
}

function onThinkingLevelCustomValInput(key: ThinkingLevel, val: string) {
  if (!drawerStore.editingModel) return;
  if (!drawerStore.editingModel.thinkingLevelMap) {
    drawerStore.editingModel.thinkingLevelMap = {};
  }
  drawerStore.editingModel.thinkingLevelMap[key] = val.trim();
  onFieldModified();
  handleAutoSave();
}

// === Cost Tiers Helpers ===
function addCostTier() {
  if (!drawerStore.editingModel?.cost) return;
  if (!drawerStore.editingModel.cost.tiers) {
    drawerStore.editingModel.cost.tiers = [];
  }
  drawerStore.editingModel.cost.tiers.push({
    inputTokensAbove: 200000,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  });
  onFieldModified();
  handleAutoSave();
}

function removeCostTier(idx: number) {
  if (!drawerStore.editingModel?.cost?.tiers) return;
  drawerStore.editingModel.cost.tiers.splice(idx, 1);
  onFieldModified();
  handleAutoSave();
}

// === Sampling Params Helpers ===
function getSamplingParam(key: string): string {
  const sp = drawerStore.editingModel?.samplingParams;
  if (!sp || sp[key] === undefined) return "";
  return String(sp[key]);
}

function setSamplingParam(key: string, val: string) {
  if (!drawerStore.editingModel) return;
  if (!drawerStore.editingModel.samplingParams) {
    drawerStore.editingModel.samplingParams = {};
  }
  if (!val.trim()) {
    delete drawerStore.editingModel.samplingParams[key];
  } else {
    const num = Number(val);
    drawerStore.editingModel.samplingParams[key] = isNaN(num) ? val : num;
  }
  onFieldModified();
  handleAutoSave();
}

const customSamplingParamsStr = computed({
  get(): Record<string, string> {
    const sp = drawerStore.editingModel?.samplingParams || {};
    const res: Record<string, string> = {};
    const standard = new Set(["temperature", "top_p", "top_k", "presence_penalty"]);
    for (const [k, v] of Object.entries(sp)) {
      if (!standard.has(k)) {
        res[k] = String(v ?? "");
      }
    }
    return res;
  },
  set(val: Record<string, string>) {
    if (!drawerStore.editingModel) return;
    if (!drawerStore.editingModel.samplingParams) {
      drawerStore.editingModel.samplingParams = {};
    }
    const standard = ["temperature", "top_p", "top_k", "presence_penalty"];
    const preserved: Record<string, unknown> = {};
    for (const k of standard) {
      if (drawerStore.editingModel.samplingParams[k] !== undefined) {
        preserved[k] = drawerStore.editingModel.samplingParams[k];
      }
    }
    for (const [k, v] of Object.entries(val)) {
      const num = Number(v);
      preserved[k] = isNaN(num) || v === "" ? v : num;
    }
    drawerStore.editingModel.samplingParams = preserved;
    onFieldModified();
    handleAutoSave();
  },
});

function onModelThinkingFormatChange(val: string) {
  if (!drawerStore.editingModel) return;
  if (!val) {
    if (drawerStore.editingModel.compat) {
      delete drawerStore.editingModel.compat.thinkingFormat;
    }
  } else {
    if (!drawerStore.editingModel.compat) {
      drawerStore.editingModel.compat = {};
    }
    drawerStore.editingModel.compat.thinkingFormat = val as any;
  }
  onFieldModified();
  handleAutoSave();
}
</script>
