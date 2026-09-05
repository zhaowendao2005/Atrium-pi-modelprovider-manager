<template>
  <div class="h-full w-full flex flex-col bg-background select-none overflow-hidden">
    <div class="px-8 py-5 border-b border-border/60 bg-card/40 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-foreground tracking-tight">系统配置与偏好设置</h2>
        <p class="text-xs text-muted-foreground mt-0.5">管理 SQLite 数据库、全局主题、链路追踪及上下文恢复策略</p>
      </div>
      <Button size="sm" variant="secondary" class="gap-1.5 text-xs" :loading="isRefreshing" @click="refreshDatabase">
        <span>刷新数据库状态</span>
      </Button>
    </div>

    <AppleScrollArea class="flex-1 px-8 py-6">
      <div class="max-w-3xl flex flex-col gap-6">
        <section class="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-3.5">
          <h3 class="font-semibold text-sm text-foreground">外观主题模式</h3>
          <div class="grid grid-cols-3 gap-3">
            <button v-for="option in themeOptions" :key="option.value" type="button" class="flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all" :class="settingsStore.settings.theme === option.value ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 hover:bg-accent/60 text-muted-foreground'" @click="settingsStore.setTheme(option.value)">
              <span>{{ option.label }}</span>
            </button>
          </div>
        </section>

        <section class="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-3.5">
          <h3 class="font-semibold text-sm text-foreground">SQLite 数据库</h3>
          <p class="text-xs text-muted-foreground">用户配置唯一存储来源，Pi 扩展以只读方式访问同一数据库。</p>
          <div class="p-2.5 bg-muted/50 rounded-xl border border-border/60 font-mono text-xs text-foreground select-all break-all">{{ databasePath || '正在读取...' }}</div>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-3 rounded-xl bg-muted/40 border border-border/50"><span class="text-muted-foreground">Providers</span><strong class="block mt-1 text-base">{{ databaseStats.providers }}</strong></div>
            <div class="p-3 rounded-xl bg-muted/40 border border-border/50"><span class="text-muted-foreground">Models</span><strong class="block mt-1 text-base">{{ databaseStats.models }}</strong></div>
          </div>
          <div v-if="databaseError" class="text-xs px-3 py-2 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">{{ databaseError }}</div>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" class="text-xs" @click="exportJson">导出 JSON</Button>
            <Button size="sm" variant="outline" class="text-xs" @click="backupDatabase">备份数据库</Button>
          </div>
        </section>

        <section class="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <h3 class="font-semibold text-sm text-foreground">网关与运行时策略</h3>
          <div class="flex items-center justify-between"><div><div class="font-medium text-xs">启用会话链路追踪</div><div class="text-[11px] text-muted-foreground">发送 x-session-id 以便定位请求</div></div><Switch :model-value="settingsStore.settings.enableHeaderTrace" @update:model-value="val => settingsStore.updateSettings({ enableHeaderTrace: val })" /></div>
          <div class="flex items-center justify-between"><div><div class="font-medium text-xs">自动上下文超长恢复</div><div class="text-[11px] text-muted-foreground">标准化中转站超长错误并交给 Pi 恢复</div></div><Switch :model-value="settingsStore.settings.enableAutoOverflowRecovery" @update:model-value="val => settingsStore.updateSettings({ enableAutoOverflowRecovery: val })" /></div>
        </section>

        <section class="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-3.5">
          <div class="flex items-center justify-between"><div><h3 class="font-semibold text-sm text-foreground">模型系列映射库</h3><p class="text-xs text-muted-foreground">维护模型系列识别数据</p></div><Button size="sm" variant="outline" class="text-xs" :loading="isUpdatingRegistry" @click="handleCheckRegistryUpdate">检查更新</Button></div>
          <div class="grid grid-cols-3 gap-3 text-xs"><div class="p-3 rounded-xl bg-muted/40 border border-border/50"><span class="text-muted-foreground">模型映射</span><strong class="block mt-1">{{ registryStats.totalModels }}</strong></div><div class="p-3 rounded-xl bg-muted/40 border border-border/50"><span class="text-muted-foreground">内置预设</span><strong class="block mt-1">{{ registryStats.presetCount }}</strong></div><div class="p-3 rounded-xl bg-muted/40 border border-border/50"><span class="text-muted-foreground">动态数据</span><strong class="block mt-1">{{ registryStats.dynamicCount }}</strong></div></div>
          <div v-if="updateFeedback" class="text-xs px-3 py-2 rounded-xl bg-primary/10 text-primary">{{ updateFeedback }}</div>
        </section>
      </div>
    </AppleScrollArea>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useSettingsStore } from "../../stores/settings.js";
import { getRegistryStats, checkFamilyMapUpdate } from "../../utils/model-family-registry.js";
import { dbBackup, dbExportJson, dbGetPath, dbGetStats } from "../../utils/sqlite-storage.js";
import AppleScrollArea from "../../components/ui/AppleScrollArea.vue";
import Button from "../../components/ui/Button.vue";
import Switch from "../../components/ui/Switch.vue";

const settingsStore = useSettingsStore();
const themeOptions = [{ value: "light" as const, label: "浅色模式" }, { value: "dark" as const, label: "深色模式" }, { value: "auto" as const, label: "跟随系统" }];
const databasePath = ref("");
const databaseStats = ref({ providers: 0, models: 0 });
const databaseError = ref("");
const isRefreshing = ref(false);
const isUpdatingRegistry = ref(false);
const updateFeedback = ref("");
const registryStats = ref(getRegistryStats());

async function refreshDatabase() {
  isRefreshing.value = true; databaseError.value = "";
  try { databasePath.value = await dbGetPath(); databaseStats.value = await dbGetStats(); }
  catch (err) { databaseError.value = `数据库状态读取失败: ${err instanceof Error ? err.message : String(err)}`; }
  finally { isRefreshing.value = false; }
}
async function exportJson() {
  try { updateFeedback.value = `脱敏配置已导出: ${await dbExportJson()}`; }
  catch (err) { databaseError.value = `JSON 导出失败: ${err instanceof Error ? err.message : String(err)}`; }
}
async function backupDatabase() { try { const target = await dbBackup(); updateFeedback.value = `数据库已备份: ${target}`; } catch (err) { databaseError.value = `数据库备份失败: ${err instanceof Error ? err.message : String(err)}`; } }
async function handleCheckRegistryUpdate() { isUpdatingRegistry.value = true; updateFeedback.value = ""; try { const result = await checkFamilyMapUpdate(true); registryStats.value = getRegistryStats(); updateFeedback.value = result.message; } catch (err) { updateFeedback.value = `检查失败: ${err instanceof Error ? err.message : String(err)}`; } finally { isUpdatingRegistry.value = false; } }
onMounted(refreshDatabase);
</script>
