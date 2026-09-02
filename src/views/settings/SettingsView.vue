<template>
  <div class="h-full w-full flex flex-col bg-background select-none overflow-hidden">
    <!-- Header -->
    <div class="px-8 py-5 border-b border-border/60 bg-card/40 backdrop-blur-md flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-foreground tracking-tight">
          系统配置与偏好设置
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          管理 YAML 持久化路径、全局主题外观、链路追踪及上下文自动恢复策略
        </p>
      </div>

      <!-- Copy YAML Button -->
      <Button size="sm" variant="secondary" class="gap-1.5 text-xs" @click="copyYaml">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>复制 YAML 文本</span>
      </Button>
    </div>

    <!-- Body with AppleScrollArea -->
    <AppleScrollArea class="flex-1 px-8 py-6">
      <div class="max-w-3xl flex flex-col gap-6">
        <!-- 1. Theme Settings Card -->
        <div class="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-3.5">
          <div class="flex items-center gap-2.5 pb-2 border-b border-border/50">
            <div class="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-sm text-foreground">外观主题模式</h3>
              <p class="text-xs text-muted-foreground">支持浅色、深色及跟随操作系统自动切换</p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <!-- Light -->
            <button
              type="button"
              class="flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all"
              :class="[
                settingsStore.settings.theme === 'light'
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border/60 hover:bg-accent/60 text-muted-foreground',
              ]"
              @click="settingsStore.setTheme('light')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>浅色模式</span>
            </button>

            <!-- Dark -->
            <button
              type="button"
              class="flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all"
              :class="[
                settingsStore.settings.theme === 'dark'
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border/60 hover:bg-accent/60 text-muted-foreground',
              ]"
              @click="settingsStore.setTheme('dark')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <span>深色模式</span>
            </button>

            <!-- Auto -->
            <button
              type="button"
              class="flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all"
              :class="[
                settingsStore.settings.theme === 'auto'
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border/60 hover:bg-accent/60 text-muted-foreground',
              ]"
              @click="settingsStore.setTheme('auto')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>跟随系统</span>
            </button>
          </div>
        </div>

        <!-- 2. Persistence Path Card -->
        <div class="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-3.5">
          <div class="flex items-center gap-2.5 pb-2 border-b border-border/50">
            <div class="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-sm text-foreground">数据持久化存储位置</h3>
              <p class="text-xs text-muted-foreground">与 Pi Agent 根目录平级的 YAML 配置文件</p>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-foreground">持久化路径</label>
            <div class="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs text-foreground select-all">
              ~/.pi/pi-modelprovider-manager-data/config.yaml
            </div>
          </div>
        </div>

        <!-- 3. Gateway & Runtime Strategy -->
        <div class="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <div class="flex items-center gap-2.5 pb-2 border-b border-border/50">
            <div class="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-sm text-foreground">网关与运行时优化策略</h3>
              <p class="text-xs text-muted-foreground">全链路追踪及上下文超长自动恢复策略</p>
            </div>
          </div>

          <!-- Header Trace -->
          <div class="flex items-center justify-between py-1">
            <div>
              <div class="font-medium text-xs text-foreground">启用会话全链路追踪 (x-session-id)</div>
              <div class="text-[11px] text-muted-foreground">在发送给中转站/提供商的 HTTP Headers 中自动附带 Session ID</div>
            </div>
            <Switch
              :model-value="settingsStore.settings.enableHeaderTrace"
              @update:model-value="val => settingsStore.updateSettings({ enableHeaderTrace: val })"
            />
          </div>

          <!-- Auto Overflow Recovery -->
          <div class="flex items-center justify-between py-1">
            <div>
              <div class="font-medium text-xs text-foreground">自动上下文超长恢复 (Compaction Auto Recovery)</div>
              <div class="text-[11px] text-muted-foreground">拦截中转站自定义溢出错误并标准化，触发 Pi 自动压缩与重试</div>
            </div>
            <Switch
              :model-value="settingsStore.settings.enableAutoOverflowRecovery"
              @update:model-value="val => settingsStore.updateSettings({ enableAutoOverflowRecovery: val })"
            />
          </div>
        </div>

        <!-- 4. Raw YAML Preview Card -->
        <div class="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-3">
          <div class="flex items-center justify-between pb-2 border-b border-border/50">
            <h3 class="font-semibold text-sm text-foreground">当前配置 YAML 实时预览</h3>
            <span class="text-xs text-muted-foreground font-mono">config.yaml</span>
          </div>

          <pre class="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed selection:bg-primary/40">{{ rawYaml }}</pre>
        </div>
      </div>
    </AppleScrollArea>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import * as YAML from "yaml";
import { useSettingsStore } from "../../stores/settings.js";
import { useProviderStore } from "../../stores/provider.js";
import AppleScrollArea from "../../components/ui/AppleScrollArea.vue";
import Button from "../../components/ui/Button.vue";
import Switch from "../../components/ui/Switch.vue";

const settingsStore = useSettingsStore();
const providerStore = useProviderStore();

const rawYaml = computed(() => {
  return YAML.stringify({
    version: 1,
    settings: settingsStore.settings,
    providers: providerStore.providers,
  });
});

function copyYaml() {
  navigator.clipboard.writeText(rawYaml.value);
  alert("已成功复制 YAML 配置到剪贴板！");
}
</script>
