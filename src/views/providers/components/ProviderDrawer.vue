<template>
  <Sheet
    :model-value="drawerStore.isOpen && (drawerStore.drawerType === 'provider-add' || drawerStore.drawerType === 'provider-edit')"
    :title="drawerStore.drawerType === 'provider-add' ? '添加模型提供商' : '编辑模型提供商'"
    description="配置网关端点、底层通信协议 (9 种支持格式) 及鉴权参数"
    @update:model-value="val => { if (!val) drawerStore.closeDrawer() }"
  >
    <div v-if="drawerStore.editingProvider" class="flex flex-col gap-5 text-sm">
      <!-- Top Preset Macro Selection Bar (官方预设宏快捷套用) -->
      <div class="p-3.5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <!-- Sparkles SVG -->
            <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span>套用官方提供商预设模版</span>
          </div>

          <!-- Status Indicator -->
          <div class="flex items-center gap-1.5 text-[11px]">
            <span
              v-if="drawerStore.editingProvider.appliedPreset && drawerStore.editingProvider.appliedPreset !== 'custom'"
              class="px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium"
            >
              已套用: {{ getPresetDisplayName(drawerStore.editingProvider.appliedPreset) }}
            </span>
            <span
              v-else-if="drawerStore.editingProvider.appliedPreset === 'custom'"
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

        <!-- Combobox Select Preset -->
        <div class="flex items-center gap-2.5">
          <ProviderLogo
            :provider="{ id: selectedPresetId, appliedPreset: selectedPresetId }"
            :size="32"
            class="rounded-xl shadow-xs border border-border/60"
          />
          <div class="relative flex-1">
            <Select
              :model-value="selectedPresetId"
              :options="presetSelectOptions"
              @update:model-value="onApplyPresetChange"
            />
          </div>
        </div>
        <p class="text-[11px] text-muted-foreground">
          套用预设会批量填充 BaseURL、推荐协议与兼容参数；您可继续修改任意参数，修改后将自动保存并转为自定义。
        </p>
      </div>

      <!-- Basic Config Section -->
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            基础接入信息
          </h4>
          <ProviderLogo :provider="drawerStore.editingProvider" :size="24" class="rounded-md border border-border/40" />
        </div>

        <!-- ID -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            唯一标识 (Provider ID) <span class="text-destructive">*</span>
          </label>
          <Input
            v-model="drawerStore.editingProvider.id"
            placeholder="例如: my-oneapi 或 openai-proxy"
            :disabled="drawerStore.drawerType === 'provider-edit'"
            @blur="handleAutoSave"
            @input="onFieldModified"
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
            @blur="handleAutoSave"
            @input="onFieldModified"
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
            @blur="handleAutoSave"
            @input="onFieldModified"
          />
          <!-- 2 行小字：预览当前模型 Fetch 地址和请求地址 -->
          <div class="flex flex-col gap-0.5 text-[11px] font-mono text-muted-foreground/80 select-all">
            <div class="flex items-center gap-1.5 truncate">
              <span class="text-muted-foreground/60 font-sans font-medium flex-shrink-0">请求地址:</span>
              <span class="truncate text-foreground/80">{{ drawerStore.editingProvider.baseUrl || '-' }}</span>
            </div>
            <div class="flex items-center gap-1.5 truncate">
              <span class="text-muted-foreground/60 font-sans font-medium flex-shrink-0">模型 Fetch 地址:</span>
              <span class="truncate text-primary/90 font-medium">{{ drawerEditingFetchUrl }}</span>
            </div>
          </div>
        </div>

        <!-- Protocol Select (9 Wire Protocols) -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            底层通信协议 (Wire Protocol)
          </label>
          <Select
            v-model="drawerStore.editingProvider.api"
            :options="protocolOptions"
            @change="() => { onFieldModified(); handleAutoSave(); }"
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
            placeholder="支持 $ENV_VAR 环境变量引用、!cmd 命令或明文 Key"
            @blur="handleAutoSave"
            @input="onFieldModified"
          />
          <p class="text-[10px] text-muted-foreground">
            支持 <code class="text-primary font-mono">$ENV_VAR</code> 或 <code class="text-primary font-mono">!security find-generic-password...</code> 动态指令
          </p>
        </div>

        <!-- OAuth Selection -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-foreground">
            OAuth 订阅 / 动态认证类型
          </label>
          <Select
            :model-value="drawerStore.editingProvider.oauth || ''"
            :options="oauthOptions"
            @update:model-value="val => { drawerStore.editingProvider!.oauth = (val as any) || undefined; onFieldModified(); handleAutoSave(); }"
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
          <Switch
            v-model="drawerStore.editingProvider.enabled"
            @change="handleAutoSave"
          />
        </div>

        <!-- Auth Header Switch -->
        <div class="flex items-center justify-between py-1">
          <div>
            <div class="font-medium text-xs text-foreground">自动注入 Bearer Token</div>
            <div class="text-[11px] text-muted-foreground">自动附带 Authorization: Bearer &lt;key&gt; 请求头</div>
          </div>
          <Switch
            v-model="drawerStore.editingProvider.authHeader"
            @change="handleAutoSave"
          />
        </div>

        <!-- Auto Discover Switch -->
        <div class="flex items-center justify-between py-1">
          <div>
            <div class="font-medium text-xs text-foreground">动态模型自动发现</div>
            <div class="text-[11px] text-muted-foreground">向模型 Fetch 地址发起探测并自动拉取最新模型</div>
          </div>
          <Switch
            v-model="drawerStore.editingProvider.autoDiscover"
            @change="handleAutoSave"
          />
        </div>

        <!-- Custom Discovery Endpoint -->
        <div v-if="drawerStore.editingProvider.autoDiscover" class="flex flex-col gap-1.5 pt-1 pl-3 border-l-2 border-primary/30">
          <label class="text-xs font-medium text-foreground">
            自定义模型拉取地址 (Discovery Endpoint)
          </label>
          <Input
            v-model="drawerStore.editingProvider.discoveryEndpoint"
            placeholder="留空则默认为: {baseUrl}/models (例如中转站需要 /v1/models)"
            @blur="handleAutoSave"
            @input="onFieldModified"
          />
        </div>
      </div>

      <!-- Environment Variables Section -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          提供商作用域环境变量 (Scoped Env)
        </h4>
        <p class="text-[11px] text-muted-foreground">
          用于 Cloudflare (<code class="text-primary font-mono">CLOUDFLARE_ACCOUNT_ID</code>), Azure (<code class="text-primary font-mono">AZURE_OPENAI_RESOURCE_NAME</code>) 等专属环境变量
        </p>
        <KeyValueEditor
          v-model="drawerStore.editingProvider.env"
          key-placeholder="变量名 (如 CLOUDFLARE_ACCOUNT_ID)"
          value-placeholder="变量值"
          add-button-text="添加环境变量"
          empty-text="暂未配置环境变量"
          @update:model-value="() => { onFieldModified(); handleAutoSave(); }"
        />
      </div>

      <!-- Custom Headers Section -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          自定义请求头 (Headers)
        </h4>
        <p class="text-[11px] text-muted-foreground">
          向该提供商发起请求时全局注入的 HTTP 请求头（如 Trace ID、Organization 等）
        </p>
        <KeyValueEditor
          v-model="drawerStore.editingProvider.headers"
          key-placeholder="Header 名称 (如 x-trace-id)"
          value-placeholder="Header 值"
          add-button-text="添加请求头"
          empty-text="暂未配置网关请求头"
          @update:model-value="() => { onFieldModified(); handleAutoSave(); }"
        />
      </div>

      <!-- Section: Adaptation Patches -->
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

        <div v-if="showPatches && drawerStore.editingProvider.compat" class="flex flex-col gap-3 bg-muted/20 p-3 rounded-xl">
          <div class="flex items-center justify-between py-1.5">
            <div>
              <div class="text-xs text-foreground font-medium flex items-center">
                <span>过滤 Responses 思考状态 (omitResponsesReasoningStatus)</span>
                <FieldDocButton field="omitResponsesReasoningStatus" title="过滤 Responses 思考状态" />
              </div>
              <div class="text-[11px] text-muted-foreground">从上下文重放的 reasoning 块中移除 output-only 字段 'status'</div>
            </div>
            <TriStateSegment
              type="provider"
              :model-value="getCompatBool('omitResponsesReasoningStatus')"
              :fallback-value="getKernelCompatDefault('omitResponsesReasoningStatus')"
              @update:model-value="val => setCompatBool('omitResponsesReasoningStatus', val)"
            />
          </div>
        </div>
      </div>

      <!-- Compat Settings Section -->
      <div class="flex flex-col gap-3 pt-3 border-t border-border">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pi Agent 兼容性适配矩阵 (Compat)
            </h4>
            <FieldDocButton field="compatMatrixOverview" title="兼容性适配矩阵全景与补丁机制" />
          </div>
          <button
            type="button"
            class="text-[11px] text-primary hover:underline flex items-center gap-1"
            @click="showAdvancedCompat = !showAdvancedCompat"
          >
            <span>{{ showAdvancedCompat ? '收起高级选项' : '展开高级适配' }}</span>
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="{ 'rotate-180': showAdvancedCompat }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div v-if="showAdvancedCompat && drawerStore.editingProvider.compat" class="flex flex-col gap-3 bg-muted/20 p-3 rounded-xl">
          <!-- Thinking Format Select -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">思考链传递格式 (Thinking Format)</label>
            <Select
              v-model="drawerStore.editingProvider.compat.thinkingFormat"
              :options="thinkingFormatOptions"
              @change="() => { onFieldModified(); handleAutoSave(); }"
            />
          </div>

          <!-- Max Tokens Field Switch -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">最大 Token 字段名 (Max Tokens Field)</label>
            <Select
              v-model="drawerStore.editingProvider.compat.maxTokensField"
              :options="maxTokensFieldOptions"
              @change="() => { onFieldModified(); handleAutoSave(); }"
            />
          </div>

          <!-- Common Switches -->
          <div class="flex items-center justify-between py-1.5">
            <div>
              <div class="text-xs text-foreground flex items-center">
                <span>流式包含 Token 统计 (supportsUsageInStreaming)</span>
                <FieldDocButton field="supportsUsageInStreaming" title="流式包含 Token 统计" />
              </div>
              <div class="text-[11px] text-muted-foreground">发送 stream_options: { include_usage: true }</div>
            </div>
            <TriStateSegment
              type="provider"
              :model-value="getCompatBool('supportsUsageInStreaming')"
              :fallback-value="getKernelCompatDefault('supportsUsageInStreaming')"
              @update:model-value="val => setCompatBool('supportsUsageInStreaming', val)"
            />
          </div>

          <div class="flex items-center justify-between py-1.5">
            <div>
              <div class="text-xs text-foreground flex items-center">
                <span>自适应思考格式 (forceAdaptiveThinking)</span>
                <FieldDocButton field="forceAdaptiveThinking" title="自适应思考格式" />
              </div>
              <div class="text-[11px] text-muted-foreground">强制使用 Claude 3.7+ 的 adaptive thinking 协议</div>
            </div>
            <TriStateSegment
              type="provider"
              :model-value="getCompatBool('forceAdaptiveThinking')"
              :fallback-value="getKernelCompatDefault('forceAdaptiveThinking')"
              @update:model-value="val => setCompatBool('forceAdaptiveThinking', val)"
            />
          </div>

          <!-- Advanced Collapsible Section -->
          <div v-if="showAdvancedCompat" class="flex flex-col gap-2.5 pt-2 border-t border-border/60 bg-muted/20 p-3 rounded-xl">
            <div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              OpenAI / 中转站深入适配
            </div>

            <!-- Thinking Token Budget Field -->
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-foreground">思考 Token 预算字段 (Token Budget Field)</label>
              <Select
                v-model="drawerStore.editingProvider.compat.thinkingTokenBudgetField"
                :options="thinkingTokenBudgetOptions"
                @change="() => { onFieldModified(); handleAutoSave(); }"
              />
            </div>

            <!-- Deferred Tools Mode (Kimi etc) -->
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-foreground">延迟工具模式 (deferredToolsMode)</label>
              <Select
                :model-value="drawerStore.editingProvider.compat.deferredToolsMode || ''"
                :options="deferredToolsModeOptions"
                @update:model-value="val => { drawerStore.editingProvider!.compat!.deferredToolsMode = (val as any) || undefined; onFieldModified(); handleAutoSave(); }"
              />
            </div>

            <!-- Session Affinity -->
            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>发送会话粘性头 (sendSessionAffinityHeaders)</span>
                  <FieldDocButton field="sendSessionAffinityHeaders" title="发送会话粘性头" />
                </div>
                <div class="text-[11px] text-muted-foreground">开启后在启用提示词缓存时附带 session affinity 请求头</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('sendSessionAffinityHeaders')"
                :fallback-value="getKernelCompatDefault('sendSessionAffinityHeaders')"
                @update:model-value="val => setCompatBool('sendSessionAffinityHeaders', val)"
              />
            </div>

            <div v-if="drawerStore.editingProvider.compat.sendSessionAffinityHeaders" class="flex flex-col gap-1">
              <label class="text-xs font-medium text-foreground">会话粘性格式 (sessionAffinityFormat)</label>
              <Select
                :model-value="drawerStore.editingProvider.compat.sessionAffinityFormat || ''"
                :options="sessionAffinityFormatOptions"
                @update:model-value="val => { drawerStore.editingProvider!.compat!.sessionAffinityFormat = (val as any) || undefined; onFieldModified(); handleAutoSave(); }"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>支持 Developer 角色 (supportsDeveloperRole)</span>
                  <FieldDocButton field="supportsDeveloperRole" title="支持 Developer 角色" />
                </div>
                <div class="text-[11px] text-muted-foreground">设为关闭则自动回退为 system 角色</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('supportsDeveloperRole')"
                :fallback-value="getKernelCompatDefault('supportsDeveloperRole')"
                @update:model-value="val => setCompatBool('supportsDeveloperRole', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>发送 reasoning_effort (supportsReasoningEffort)</span>
                  <FieldDocButton field="supportsReasoningEffort" title="发送 reasoning_effort" />
                </div>
                <div class="text-[11px] text-muted-foreground">是否向下游发送 reasoning_effort 推理强度</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('supportsReasoningEffort')"
                :fallback-value="getKernelCompatDefault('supportsReasoningEffort')"
                @update:model-value="val => setCompatBool('supportsReasoningEffort', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>上游返回 finish_reason (supportsFinishReason)</span>
                  <FieldDocButton field="supportsFinishReason" title="上游返回 finish_reason" />
                </div>
                <div class="text-[11px] text-muted-foreground">设为关闭则在流结束时由 Pi 自动推断 (防丢 finish_reason 报错)</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('supportsFinishReason')"
                :fallback-value="getKernelCompatDefault('supportsFinishReason')"
                @update:model-value="val => setCompatBool('supportsFinishReason', val)"
              />
            </div>

            <!-- 官方内置兼容性参数与 Pi Agent 原生开关 -->
            <div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border/40">
              Pi Agent 原生兼容性选项
            </div>


            <!-- New GPT-5.4 / GPT-5.6 features -->
            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>显式提示词缓存模式 (supportsExplicitPromptCacheMode)</span>
                  <FieldDocButton field="supportsExplicitPromptCacheMode" title="显式提示词缓存模式" />
                </div>
                <div class="text-[11px] text-muted-foreground">GPT-5.6 专属显式声明提示词缓存机制</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('supportsExplicitPromptCacheMode')"
                :fallback-value="getKernelCompatDefault('supportsExplicitPromptCacheMode')"
                @update:model-value="val => setCompatBool('supportsExplicitPromptCacheMode', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>扩展附加工具 (supportsAdditionalTools)</span>
                  <FieldDocButton field="supportsAdditionalTools" title="扩展附加工具" />
                </div>
                <div class="text-[11px] text-muted-foreground">支持下游接入附加扩展工具声明</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('supportsAdditionalTools')"
                :fallback-value="getKernelCompatDefault('supportsAdditionalTools')"
                @update:model-value="val => setCompatBool('supportsAdditionalTools', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>内置工具搜索 (supportsToolSearch)</span>
                  <FieldDocButton field="supportsToolSearch" title="内置工具搜索" />
                </div>
                <div class="text-[11px] text-muted-foreground">允许模型在大量工具集上自动搜索</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('supportsToolSearch')"
                :fallback-value="getKernelCompatDefault('supportsToolSearch')"
                @update:model-value="val => setCompatBool('supportsToolSearch', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>工具结果需附带 name (requiresToolResultName)</span>
                  <FieldDocButton field="requiresToolResultName" title="工具结果需附带 name" />
                </div>
                <div class="text-[11px] text-muted-foreground">role: "tool" 消息是否必须携带 name 字段</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('requiresToolResultName')"
                :fallback-value="getKernelCompatDefault('requiresToolResultName')"
                @update:model-value="val => setCompatBool('requiresToolResultName', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>工具后插入空 Assistant (requiresAssistantAfterToolResult)</span>
                  <FieldDocButton field="requiresAssistantAfterToolResult" title="工具后插入空 Assistant" />
                </div>
                <div class="text-[11px] text-muted-foreground">某些严格中转站要求工具结果后附带一条空消息</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('requiresAssistantAfterToolResult')"
                :fallback-value="getKernelCompatDefault('requiresAssistantAfterToolResult')"
                @update:model-value="val => setCompatBool('requiresAssistantAfterToolResult', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>DeepSeek 空思考内容补全 (requiresReasoningContent)</span>
                  <FieldDocButton field="requiresReasoningContentOnAssistantMessages" title="DeepSeek 空思考内容补全" />
                </div>
                <div class="text-[11px] text-muted-foreground">回放历史 assistant 消息时附带空 reasoning_content</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('requiresReasoningContentOnAssistantMessages')"
                :fallback-value="getKernelCompatDefault('requiresReasoningContentOnAssistantMessages')"
                @update:model-value="val => setCompatBool('requiresReasoningContentOnAssistantMessages', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>思考内容转为普通文本 (requiresThinkingAsText)</span>
                  <FieldDocButton field="requiresThinkingAsText" title="思考内容转为普通文本" />
                </div>
                <div class="text-[11px] text-muted-foreground">强制将思考链转换为纯文本回放</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('requiresThinkingAsText')"
                :fallback-value="getKernelCompatDefault('requiresThinkingAsText')"
                @update:model-value="val => setCompatBool('requiresThinkingAsText', val)"
              />
            </div>

            <!-- Anthropic Detailed Section -->
            <div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border/40">
              Anthropic / Claude 原生适配
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>急切工具流式 (supportsEagerToolInputStreaming)</span>
                  <FieldDocButton field="supportsEagerToolInputStreaming" title="急切工具流式" />
                </div>
                <div class="text-[11px] text-muted-foreground">设为关闭会自动回退使用 2025-05-14 Beta 兼容头</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('supportsEagerToolInputStreaming')"
                :fallback-value="getKernelCompatDefault('supportsEagerToolInputStreaming')"
                @update:model-value="val => setCompatBool('supportsEagerToolInputStreaming', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>支持 1 小时长缓存 (supportsLongCacheRetention)</span>
                  <FieldDocButton field="supportsLongCacheRetention" title="支持 1 小时长缓存" />
                </div>
                <div class="text-[11px] text-muted-foreground">在 cache_control 中启用 ttl: "1h"</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('supportsLongCacheRetention')"
                :fallback-value="getKernelCompatDefault('supportsLongCacheRetention')"
                @update:model-value="val => setCompatBool('supportsLongCacheRetention', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>允许空签名 (allowEmptySignature)</span>
                  <FieldDocButton field="allowEmptySignature" title="允许空签名" />
                </div>
                <div class="text-[11px] text-muted-foreground">允许第三方 Claude 代理返回空 signature 回放</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('allowEmptySignature')"
                :fallback-value="getKernelCompatDefault('allowEmptySignature')"
                @update:model-value="val => setCompatBool('allowEmptySignature', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>严格模式 (supportsStrictTools)</span>
                  <FieldDocButton field="supportsStrictTools" title="严格模式" />
                </div>
                <div class="text-[11px] text-muted-foreground">启用严格的 JSON Schema 工具格式校验</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('supportsStrictTools')"
                :fallback-value="getKernelCompatDefault('supportsStrictTools')"
                @update:model-value="val => setCompatBool('supportsStrictTools', val)"
              />
            </div>

            <div class="flex items-center justify-between py-1.5">
              <div>
                <div class="text-xs text-foreground flex items-center">
                  <span>动态工具延迟引用 (supportsToolReferences)</span>
                  <FieldDocButton field="supportsToolReferences" title="动态工具延迟引用" />
                </div>
                <div class="text-[11px] text-muted-foreground">支持 Claude 原生的动态延迟工具引用机制</div>
              </div>
              <TriStateSegment
                type="provider"
                :model-value="getCompatBool('supportsToolReferences')"
                :fallback-value="getKernelCompatDefault('supportsToolReferences')"
                @update:model-value="val => setCompatBool('supportsToolReferences', val)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import { useProviderStore } from "../../../stores/provider.js";
import { usePresetsStore } from "../../../stores/presets.js";
import Sheet from "../../../components/ui/Sheet.vue";
import ProviderLogo from "../../../components/ui/ProviderLogo.vue";
import Input from "../../../components/ui/Input.vue";
import Select, { type SelectOption } from "../../../components/ui/Select.vue";
import Switch from "../../../components/ui/Switch.vue";
import TriStateSegment from "../../../components/ui/TriStateSegment.vue";
import KeyValueEditor from "../../../components/ui/KeyValueEditor.vue";
import FieldDocButton from "../../../components/ui/FieldDocButton.vue";
import { getKernelCompatDefault } from "../../../utils/effective-config.js";
import type { ProviderCompatibilityConfig } from "../../../types/index.js";

const drawerStore = useDrawerStore();
const providerStore = useProviderStore();
const presetsStore = usePresetsStore();

const showPatches = ref(false);
const showAdvancedCompat = ref(false);

function getCompatBool(field: keyof ProviderCompatibilityConfig): boolean | undefined {
  const val = drawerStore.editingProvider?.compat?.[field];
  return typeof val === "boolean" ? val : undefined;
}

function setCompatBool(field: keyof ProviderCompatibilityConfig, val: boolean | undefined) {
  if (!drawerStore.editingProvider) return;
  if (!drawerStore.editingProvider.compat) {
    drawerStore.editingProvider.compat = {};
  }
  if (val === undefined) {
    delete (drawerStore.editingProvider.compat as any)[field];
  } else {
    (drawerStore.editingProvider.compat as any)[field] = val;
  }
  onFieldModified();
  handleAutoSave();
}

onMounted(() => {
  presetsStore.loadIndex();
});

// 抽屉展开时进行二次防御检查，保证候选项始终就绪
watch(
  () => drawerStore.isOpen,
  (isOpen) => {
    if (isOpen && presetsStore.providerIndex.length === 0) {
      presetsStore.loadIndex();
    }
  },
  { immediate: true }
);

const drawerEditingFetchUrl = computed(() => {
  const p = drawerStore.editingProvider;
  if (!p || !p.baseUrl) return "-";
  return p.discoveryEndpoint || `${p.baseUrl.replace(/\/+$/, "")}/models`;
});

const presetSelectOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = [{ label: "请选择要套用的官方提供商模版...", value: "" }];
  for (const p of presetsStore.providerIndex) {
    options.push({
      label: `${p.name} (${p.modelCount} 模型)`,
      value: p.id,
    });
  }
  return options;
});

const selectedPresetId = computed(() => {
  return drawerStore.editingProvider?.appliedPreset === "custom"
    ? ""
    : (drawerStore.editingProvider?.appliedPreset || "");
});

function getPresetDisplayName(presetId: string): string {
  const found = presetsStore.providerIndex.find((p) => p.id === presetId);
  return found ? found.name : presetId;
}

async function onApplyPresetChange(presetId: string) {
  if (!presetId || !drawerStore.editingProvider) return;
  const details = await presetsStore.getProviderPreset(presetId);
  if (details) {
    presetsStore.applyProviderPreset(drawerStore.editingProvider, details);
    handleAutoSave();
  }
}

function onFieldModified() {
  if (drawerStore.editingProvider && drawerStore.editingProvider.appliedPreset) {
    drawerStore.editingProvider.appliedPreset = "custom";
  }
}

function handleAutoSave() {
  const p = drawerStore.editingProvider;
  if (!p || !p.id.trim() || !p.baseUrl.trim()) return;

  if (p.oauth === "") delete p.oauth;
  if (p.env && Object.keys(p.env).length === 0) delete p.env;
  if (p.headers && Object.keys(p.headers).length === 0) delete p.headers;
  if (p.compat && Object.keys(p.compat).length === 0) delete p.compat;

  if (drawerStore.drawerType === "provider-add") {
    const exists = providerStore.providers.find((item) => item.id === p.id);
    if (!exists) {
      providerStore.addProvider(p);
      drawerStore.drawerType = "provider-edit";
    } else {
      providerStore.updateProvider(p);
    }
  } else {
    providerStore.updateProvider(p);
  }
}

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
  { label: "默认 (None / 透传)", value: "" },
  { label: "OpenAI (reasoning: { effort })", value: "openai" },
  { label: "OpenRouter 原生格式", value: "openrouter" },
  { label: "DeepSeek (reasoning_content)", value: "deepseek" },
  { label: "Qwen 通义千问 (enable_thinking: true)", value: "qwen" },
  { label: "Together AI (reasoning: { enabled })", value: "together" },
  { label: "Baseten (chat_template_args)", value: "baseten" },
  { label: "智谱 Zhipu AI (reasoning_content)", value: "zai" },
  { label: "Chat Template (chat_template_kwargs)", value: "chat-template" },
  { label: "Qwen Chat Template", value: "qwen-chat-template" },
  { label: "String Thinking 标签解析 (<think>...</think>)", value: "string-thinking" },
  { label: "蚂蚁百灵 Ant Ling 格式", value: "ant-ling" },
];

const maxTokensFieldOptions: SelectOption[] = [
  { label: "默认 (根据端点自动判定)", value: "" },
  { label: "max_completion_tokens (OpenAI 新规范)", value: "max_completion_tokens" },
  { label: "max_tokens (传统中转站与旧接口兼容)", value: "max_tokens" },
];

const thinkingTokenBudgetOptions: SelectOption[] = [
  { label: "默认 (不发送预算字段)", value: "" },
  { label: "thinking_token_budget (vLLM)", value: "thinking_token_budget" },
  { label: "thinking_budget (Qwen / DashScope / SGLang)", value: "thinking_budget" },
  { label: "thinking_budget_tokens (llama.cpp)", value: "thinking_budget_tokens" },
];

const oauthOptions: SelectOption[] = [
  { label: "无 / 标准 API 密钥鉴权", value: "" },
  { label: "Radius Gateway 动态 OAuth (radius)", value: "radius" },
];

const deferredToolsModeOptions: SelectOption[] = [
  { label: "无 / 标准工具模式", value: "" },
  { label: "Kimi 延迟工具序列化 (kimi)", value: "kimi" },
];

const sessionAffinityFormatOptions: SelectOption[] = [
  { label: "自动判定 (默认)", value: "" },
  { label: "OpenAI 格式 (session_id / x-client-request-id)", value: "openai" },
  { label: "OpenAI 简易格式 (openai-nosession)", value: "openai-nosession" },
  { label: "OpenRouter 格式 (x-session-id)", value: "openrouter" },
];
</script>
