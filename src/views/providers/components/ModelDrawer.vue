<template>
  <Sheet
    :model-value="drawerStore.isOpen && (drawerStore.drawerType === 'model-add' || drawerStore.drawerType === 'model-edit')"
    :title="drawerStore.drawerType === 'model-add' ? '挂载新模型' : '编辑模型配置'"
    description="配置模型标识、协议覆盖、采样参数、7 档推理映射与阶梯计费"
    @update:model-value="val => { if (!val) drawerStore.closeDrawer() }"
  >
    <div v-if="drawerStore.editingModel" class="flex flex-col gap-5 text-sm">
      <!-- Top Preset Bar (官方模型预设二级上下文菜单选择器：支持搜索提供商与模型解耦套用) -->
      <div class="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-primary/5 to-transparent border border-purple-500/20 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <!-- Sparkles SVG -->
            <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>模型预设模版 (二级上下文检索与跨厂商套用)</span>
          </div>

          <!-- Status Indicator -->
          <div class="flex items-center gap-2 text-[11px]">
            <!-- Preset Origin Badge -->
            <span
              v-if="effectiveConfig?.presetOrigin.hasPreset && !effectiveConfig.presetOrigin.isModified"
              class="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium truncate max-w-[200px]"
              :title="effectiveConfig.presetOrigin.description"
            >
              {{ effectiveConfig.presetOrigin.badgeText }}
            </span>
            <span
              v-else-if="effectiveConfig?.presetOrigin.hasPreset && effectiveConfig.presetOrigin.isModified"
              class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium truncate max-w-[220px]"
              :title="effectiveConfig.presetOrigin.description"
            >
              {{ effectiveConfig.presetOrigin.badgeText }}
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded-full bg-slate-500/15 text-muted-foreground font-medium"
            >
              完全自定义配置
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
              <span>已保存</span>
            </span>
          </div>
        </div>

        <div class="w-full">
          <ModelPresetCascadeSelect
            :parent-provider-id="drawerStore.targetProviderId || undefined"
            :applied-preset-id="drawerStore.editingModel.appliedPreset"
            @select="onApplyModelPresetSelected"
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
          <label class="text-xs font-medium text-foreground flex items-center">
            <span>模型 ID (传给上游的 model 字段) <span class="text-destructive">*</span></span>
            <FieldDocButton field="id" title="模型 ID" />
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
          <label class="text-xs font-medium text-foreground flex items-center">
            <span>显示名称 (Display Name)</span>
            <FieldDocButton field="name" title="显示名称" />
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
          <label class="text-xs font-medium text-foreground flex items-center">
            <span>模型系列归属 (Family 分组)</span>
            <FieldDocButton field="family" title="模型系列" />
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
            <div class="font-medium text-xs text-foreground flex items-center">
              <span>支持图像视觉输入 (Vision / Multimodal)</span>
              <FieldDocButton field="input" title="支持模态" />
            </div>
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
            <div class="font-medium text-xs text-foreground flex items-center">
              <span>支持推理思考 (Reasoning / CoT)</span>
              <FieldDocButton field="reasoning" title="思考能力" />
            </div>
            <div class="text-[11px] text-muted-foreground">支持思考链输出隔离与深度思考调节</div>
          </div>
          <Switch v-model="drawerStore.editingModel.reasoning" />
        </div>

        <!-- Thinking Level Map (7 Levels, available when reasoning is enabled) -->
        <div v-if="drawerStore.editingModel.reasoning" class="flex flex-col gap-2.5 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
          <div class="flex items-center justify-between">
            <div class="font-medium text-xs text-purple-700 dark:text-purple-300 flex items-center">
              <span>7 档推理思考强度映射 (thinkingLevelMap)</span>
              <FieldDocButton field="thinkingLevelMap" title="思考强度映射" />
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
            <label class="text-xs font-medium text-foreground flex items-center">
              <span>上下文窗口 (Context Window)</span>
              <FieldDocButton field="contextWindow" title="上下文长度" />
            </label>
            <Input
              v-model="drawerStore.editingModel.contextWindow"
              type="number"
              placeholder="128000"
            />
          </div>

          <!-- Max Output Tokens -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground flex items-center">
              <span>单次最大输出 (Max Tokens)</span>
              <FieldDocButton field="maxTokens" title="单次最大输出" />
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
          <div class="flex items-center">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              计费费率 ($ / 每百万 Tokens)
            </h4>
            <FieldDocButton field="cost" title="计费费率" />
          </div>
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
              <label class="text-xs font-medium text-foreground flex items-center">
                <span>覆盖底层通信协议 (api)</span>
                <FieldDocButton field="api" title="通信协议" />
              </label>
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
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-foreground flex items-center">
                <span>覆盖 Base URL 端点 (baseUrl)</span>
                <FieldDocButton field="baseUrl" title="模型独立 Base URL" />
              </label>
              <span v-if="parentProvider?.baseUrl" class="text-[10px] text-muted-foreground truncate max-w-[240px]">
                继承提供商: {{ parentProvider.baseUrl }}
              </span>
            </div>
            <Input
              v-model="drawerStore.editingModel.baseUrl"
              :placeholder="`留空则继承提供商 Base URL (${parentProvider?.baseUrl || '未配置'})`"
            />
          </div>

          <!-- Override Headers -->
          <div class="flex flex-col gap-1.5 pt-1">
            <label class="text-xs font-medium text-foreground flex items-center">
              <span>模型专属附加 Headers (与全局合并)</span>
              <FieldDocButton field="headers" title="模型独立请求头" />
            </label>
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
          <div class="flex items-center">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              采样参数注入 (samplingParams)
            </h4>
            <FieldDocButton field="samplingParams" title="采样参数" />
          </div>
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

      <!-- Section: Adaptation Patches Override -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              请求修复与中转补丁 (Adaptation Patches)
            </h4>
            <FieldDocButton field="adaptationPatchesOverview" title="中转适配补丁全景说明" />
          </div>
          <button
            type="button"
            class="text-[11px] text-primary hover:underline flex items-center gap-1"
            @click="showPatches = !showPatches"
          >
            <span>{{ showPatches ? '收起补丁选项' : '展开补丁选项' }}</span>
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="{ 'rotate-180': showPatches }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div v-if="showPatches" class="flex items-center justify-between py-1.5 bg-muted/20 p-3 rounded-xl">
          <div>
            <div class="text-xs font-medium text-foreground flex items-center">
              <span>过滤 Responses 思考状态 (omitResponsesReasoningStatus)</span>
              <FieldDocButton field="omitResponsesReasoningStatus" title="过滤 Responses 思考状态" />
            </div>
            <div class="text-[11px] text-muted-foreground">从上下文重放的 reasoning 块中移除 output-only 字段 'status'</div>
          </div>
          <TriStateSegment
            type="model"
            :model-value="getModelCompatBool('omitResponsesReasoningStatus')"
            :fallback-value="getModelCompatFallback('omitResponsesReasoningStatus')"
            @update:model-value="val => setModelCompatBool('omitResponsesReasoningStatus', val)"
          />
        </div>
      </div>

      <!-- Section: Model Compat Override -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pi Agent 兼容性覆盖 (Model Compat)
            </h4>
            <FieldDocButton field="compatMatrixOverview" title="兼容性适配矩阵全景与补丁机制" />
          </div>
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
            <label class="text-xs font-medium text-foreground flex items-center">
              <span>独立思考链传递格式 (thinkingFormat)</span>
              <FieldDocButton field="thinkingFormat" title="思考链传递格式" />
            </label>
            <Select
              :model-value="drawerStore.editingModel.compat?.thinkingFormat || ''"
              :options="modelThinkingFormatOptions"
              @update:model-value="onModelThinkingFormatChange"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground flex items-center">
              <span>最大 Token 字段覆盖 (maxTokensField)</span>
              <FieldDocButton field="maxTokensField" title="最大 Token 字段名" />
            </label>
            <Select
              :model-value="drawerStore.editingModel.compat?.maxTokensField || ''"
              :options="modelMaxTokensFieldOptions"
              @update:model-value="val => onModelCompatFieldChange('maxTokensField', val)"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground flex items-center">
              <span>思考预算字段 (thinkingTokenBudgetField)</span>
              <FieldDocButton field="thinkingTokenBudgetField" title="思考预算字段" />
            </label>
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

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>上游返回 finish_reason (supportsFinishReason)</span>
                  <FieldDocButton field="supportsFinishReason" title="上游返回 finish_reason" />
                </span>
                <div class="text-[11px] text-muted-foreground">关闭则在流结束时由 Pi 自动推断 (防丢 finish_reason 报错)</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsFinishReason')"
                :fallback-value="getModelCompatFallback('supportsFinishReason')"
                @update:model-value="val => setModelCompatBool('supportsFinishReason', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>流式包含 Token 统计 (supportsUsageInStreaming)</span>
                  <FieldDocButton field="supportsUsageInStreaming" title="流式包含 Token 统计" />
                </span>
                <div class="text-[11px] text-muted-foreground">发送 stream_options: { include_usage: true }</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsUsageInStreaming')"
                :fallback-value="getModelCompatFallback('supportsUsageInStreaming')"
                @update:model-value="val => setModelCompatBool('supportsUsageInStreaming', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>支持 Developer 角色 (supportsDeveloperRole)</span>
                  <FieldDocButton field="supportsDeveloperRole" title="支持 Developer 角色" />
                </span>
                <div class="text-[11px] text-muted-foreground">设为关闭则自动回退为 system 角色</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsDeveloperRole')"
                :fallback-value="getModelCompatFallback('supportsDeveloperRole')"
                @update:model-value="val => setModelCompatBool('supportsDeveloperRole', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>发送 reasoning_effort (supportsReasoningEffort)</span>
                  <FieldDocButton field="supportsReasoningEffort" title="发送 reasoning_effort" />
                </span>
                <div class="text-[11px] text-muted-foreground">是否向下游发送 reasoning_effort 推理强度</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsReasoningEffort')"
                :fallback-value="getModelCompatFallback('supportsReasoningEffort')"
                @update:model-value="val => setModelCompatBool('supportsReasoningEffort', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>自适应思考 (forceAdaptiveThinking)</span>
                  <FieldDocButton field="forceAdaptiveThinking" title="强制自适应思考" />
                </span>
                <div class="text-[11px] text-muted-foreground">强制使用 Claude 3.7+ 的 adaptive thinking 协议</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('forceAdaptiveThinking')"
                :fallback-value="getModelCompatFallback('forceAdaptiveThinking')"
                @update:model-value="val => setModelCompatBool('forceAdaptiveThinking', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>允许空思考签名 (allowEmptySignature)</span>
                  <FieldDocButton field="allowEmptySignature" title="允许空思考签名" />
                </span>
                <div class="text-[11px] text-muted-foreground">允许第三方 Claude 代理返回空 signature 回放</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('allowEmptySignature')"
                :fallback-value="getModelCompatFallback('allowEmptySignature')"
                @update:model-value="val => setModelCompatBool('allowEmptySignature', val)"
              />
            </div>

            <!-- New GPT-5.4 / GPT-5.6 Tri-state Switches -->
            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>显式提示词缓存 (supportsExplicitPromptCacheMode)</span>
                  <FieldDocButton field="supportsExplicitPromptCacheMode" title="显式提示词缓存" />
                </span>
                <div class="text-[11px] text-muted-foreground">GPT-5.6 专属显式声明提示词缓存机制</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsExplicitPromptCacheMode')"
                :fallback-value="getModelCompatFallback('supportsExplicitPromptCacheMode')"
                @update:model-value="val => setModelCompatBool('supportsExplicitPromptCacheMode', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>扩展附加工具 (supportsAdditionalTools)</span>
                  <FieldDocButton field="supportsAdditionalTools" title="扩展附加工具" />
                </span>
                <div class="text-[11px] text-muted-foreground">支持下游接入附加扩展工具声明</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsAdditionalTools')"
                :fallback-value="getModelCompatFallback('supportsAdditionalTools')"
                @update:model-value="val => setModelCompatBool('supportsAdditionalTools', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>内置工具搜索 (supportsToolSearch)</span>
                  <FieldDocButton field="supportsToolSearch" title="内置工具搜索" />
                </span>
                <div class="text-[11px] text-muted-foreground">允许模型在大量工具集上自动搜索</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsToolSearch')"
                :fallback-value="getModelCompatFallback('supportsToolSearch')"
                @update:model-value="val => setModelCompatBool('supportsToolSearch', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>工具必须含 Name (requiresToolResultName)</span>
                  <FieldDocButton field="requiresToolResultName" title="工具返回必须附带 Name" />
                </span>
                <div class="text-[11px] text-muted-foreground">role: "tool" 消息是否必须携带 name 字段</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('requiresToolResultName')"
                :fallback-value="getModelCompatFallback('requiresToolResultName')"
                @update:model-value="val => setModelCompatBool('requiresToolResultName', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>工具后跟随 Assistant (requiresAssistantAfterToolResult)</span>
                  <FieldDocButton field="requiresAssistantAfterToolResult" title="工具返回后强制跟随 Assistant 消息" />
                </span>
                <div class="text-[11px] text-muted-foreground">某些严格中转站要求工具结果后附带一条空消息</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('requiresAssistantAfterToolResult')"
                :fallback-value="getModelCompatFallback('requiresAssistantAfterToolResult')"
                @update:model-value="val => setModelCompatBool('requiresAssistantAfterToolResult', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>Assistant 含推理字段 (requiresReasoningContentOnAssistantMessages)</span>
                  <FieldDocButton field="requiresReasoningContentOnAssistantMessages" title="Assistant 消息必须包含推理字段" />
                </span>
                <div class="text-[11px] text-muted-foreground">回放历史 assistant 消息时附带空 reasoning_content</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('requiresReasoningContentOnAssistantMessages')"
                :fallback-value="getModelCompatFallback('requiresReasoningContentOnAssistantMessages')"
                @update:model-value="val => setModelCompatBool('requiresReasoningContentOnAssistantMessages', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>思考内容转文本 (requiresThinkingAsText)</span>
                  <FieldDocButton field="requiresThinkingAsText" title="思考内容转为普通文本" />
                </span>
                <div class="text-[11px] text-muted-foreground">强制将思考链转换为纯文本回放</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('requiresThinkingAsText')"
                :fallback-value="getModelCompatFallback('requiresThinkingAsText')"
                @update:model-value="val => setModelCompatBool('requiresThinkingAsText', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>工具即时流式解析 (supportsEagerToolInputStreaming)</span>
                  <FieldDocButton field="supportsEagerToolInputStreaming" title="工具输入即时流式解析" />
                </span>
                <div class="text-[11px] text-muted-foreground">关闭则回退使用 2025-05-14 Beta 兼容头</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsEagerToolInputStreaming')"
                :fallback-value="getModelCompatFallback('supportsEagerToolInputStreaming')"
                @update:model-value="val => setModelCompatBool('supportsEagerToolInputStreaming', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>1 小时长缓存 (supportsLongCacheRetention)</span>
                  <FieldDocButton field="supportsLongCacheRetention" title="支持 1 小时长缓存" />
                </span>
                <div class="text-[11px] text-muted-foreground">在 cache_control 中启用 ttl: "1h"</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsLongCacheRetention')"
                :fallback-value="getModelCompatFallback('supportsLongCacheRetention')"
                @update:model-value="val => setModelCompatBool('supportsLongCacheRetention', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>严格模式 (supportsStrictTools)</span>
                  <FieldDocButton field="supportsStrictTools" title="严格模式" />
                </span>
                <div class="text-[11px] text-muted-foreground">启用严格的 JSON Schema 工具格式校验</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsStrictTools')"
                :fallback-value="getModelCompatFallback('supportsStrictTools')"
                @update:model-value="val => setModelCompatBool('supportsStrictTools', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5 text-xs">
              <div>
                <span class="flex items-center font-medium text-foreground">
                  <span>动态工具延迟引用 (supportsToolReferences)</span>
                  <FieldDocButton field="supportsToolReferences" title="动态工具延迟引用" />
                </span>
                <div class="text-[11px] text-muted-foreground">支持 Claude 原生的动态延迟工具引用机制</div>
              </div>
              <TriStateSegment
                type="model"
                :model-value="getModelCompatBool('supportsToolReferences')"
                :fallback-value="getModelCompatFallback('supportsToolReferences')"
                @update:model-value="val => setModelCompatBool('supportsToolReferences', val)"
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
import { resolveEffectiveModelConfig, getInheritedCompatFallback } from "../../../utils/effective-config.js";
import Sheet from "../../../components/ui/Sheet.vue";
import Input from "../../../components/ui/Input.vue";
import Select, { type SelectOption } from "../../../components/ui/Select.vue";
import Switch from "../../../components/ui/Switch.vue";
import TriStateSegment from "../../../components/ui/TriStateSegment.vue";
import KeyValueEditor from "../../../components/ui/KeyValueEditor.vue";
import ModelPresetCascadeSelect from "../../../components/ui/ModelPresetCascadeSelect.vue";
import FieldDocButton from "../../../components/ui/FieldDocButton.vue";

const drawerStore = useDrawerStore();
const providerStore = useProviderStore();
const presetsStore = usePresetsStore();

const showThinkingMap = ref(false);
const showCostTiers = ref(false);
const showOverrides = ref(false);
const showSamplingParams = ref(false);
const showPatches = ref(false);
const showModelCompat = ref(false);

const suggestedPresetModel = ref<ModelSchema | null>(null);

const parentProvider = computed(() => {
  const pid = drawerStore.targetProviderId;
  if (!pid) return null;
  return providerStore.providers.find((p) => p.id === pid) || null;
});

const effectiveConfig = computed(() => {
  const m = drawerStore.editingModel;
  const p = parentProvider.value;
  if (!m || !p) return null;
  return resolveEffectiveModelConfig(p, m);
});

async function onModelIdInput() {
  onFieldModified();
  const mid = drawerStore.editingModel?.id;
  const pid = drawerStore.targetProviderId;
  if (!mid || mid.length < 2) {
    suggestedPresetModel.value = null;
    return;
  }
  // 全局跨提供商智能模糊相近匹配（优先匹配当前提供商，若当前为代理/自定义中转商则在主流官方厂商中匹配）
  const match = await presetsStore.findGlobalBestMatchModel(mid, pid || undefined);
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

function onApplyModelPresetSelected(model: ModelSchema) {
  if (!drawerStore.editingModel) return;
  presetsStore.applyModelPreset(drawerStore.editingModel, model);
  suggestedPresetModel.value = null;
  handleAutoSave();
}

function onFieldModified() {
  if (drawerStore.editingModel) {
    drawerStore.editingModel.isModified = true;
    if (drawerStore.editingModel.appliedPreset) {
      drawerStore.editingModel.appliedPreset = "custom";
    }
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

function getModelCompatBool(field: string): boolean | undefined {
  const compat = drawerStore.editingModel?.compat;
  if (!compat || (compat as any)[field] === undefined) return undefined;
  return Boolean((compat as any)[field]);
}

function getModelCompatFallback(field: string): boolean {
  return getInheritedCompatFallback(parentProvider.value?.compat, field);
}

function setModelCompatBool(field: string, val: boolean | undefined) {
  if (!drawerStore.editingModel) return;
  if (!drawerStore.editingModel.compat) {
    drawerStore.editingModel.compat = {};
  }
  if (val === undefined) {
    delete (drawerStore.editingModel.compat as any)[field];
  } else {
    (drawerStore.editingModel.compat as any)[field] = val;
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
