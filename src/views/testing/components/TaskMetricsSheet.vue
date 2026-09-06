<template>
  <Sheet
    :model-value="drawerStore.isTestMetricsOpen"
    :title="sheetTitle"
    :description="sheetDesc"
    max-width-class="max-w-2xl"
    @update:model-value="onOpenChange"
  >
    <div class="flex flex-col gap-5 py-1 select-none">
      <!-- 1. 顶部全局汇总性能指标卡片 -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <!-- 含首字 TPS -->
        <div class="p-3 rounded-2xl bg-muted/40 border border-border/60 flex flex-col gap-1">
          <span class="text-[11px] text-muted-foreground font-medium">含首字 TPS</span>
          <span class="text-base font-bold font-mono text-foreground">
            {{ currentMetrics.tpsWithTtft ? `${currentMetrics.tpsWithTtft} tps` : "--" }}
          </span>
          <span class="text-[10px] text-muted-foreground/70">端到端响应速率</span>
        </div>

        <!-- 不含首字 TPS -->
        <div class="p-3 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col gap-1">
          <span class="text-[11px] text-primary font-medium">不含首字 TPS</span>
          <span class="text-base font-bold font-mono text-primary">
            {{ currentMetrics.tpsWithoutTtft ? `${currentMetrics.tpsWithoutTtft} tps` : "--" }}
          </span>
          <span class="text-[10px] text-primary/70">纯解码生成速率</span>
        </div>

        <!-- 首字延迟 TTFT -->
        <div class="p-3 rounded-2xl bg-muted/40 border border-border/60 flex flex-col gap-1">
          <span class="text-[11px] text-muted-foreground font-medium">首轮 TTFT</span>
          <span class="text-base font-bold font-mono text-foreground">
            {{ currentMetrics.firstTokenMs ? `${currentMetrics.firstTokenMs}ms` : "--" }}
          </span>
          <span class="text-[10px] text-muted-foreground/70">首字生成时延</span>
        </div>

        <!-- 总轮次与 Tokens -->
        <div class="p-3 rounded-2xl bg-muted/40 border border-border/60 flex flex-col gap-1">
          <span class="text-[11px] text-muted-foreground font-medium">Tokens / 轮次</span>
          <span class="text-base font-bold font-mono text-foreground">
            {{ currentMetrics.completionTokens }} tok
          </span>
          <span class="text-[10px] text-muted-foreground/70">
            共 {{ requestList.length }} 次交互请求
          </span>
        </div>
      </div>

      <!-- 2. 时序节点与时序图说明 -->
      <div class="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span class="font-semibold text-foreground/80 tracking-wide uppercase text-[11px]">
          请求时序链路 (Git Timeline)
        </span>
        <span class="text-[11px]">鼠标悬停小圆点查看东八区毫秒级时间戳</span>
      </div>

      <!-- 3. 无请求空状态 -->
      <div
        v-if="requestList.length === 0"
        class="h-44 rounded-2xl border border-dashed border-border/70 flex flex-col items-center justify-center text-center text-muted-foreground"
      >
        <svg class="w-7 h-7 text-muted-foreground/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p class="text-xs">尚无请求指标记录</p>
        <p class="text-[11px] text-muted-foreground/60 mt-0.5">点击下方控制台「执行测试」开始采集微观时序性能</p>
      </div>

      <!-- 4. Git 风格时序图与虚拟窗口列表 -->
      <div
        v-else
        ref="listContainerRef"
        class="relative flex flex-col min-h-[300px]"
        :style="{ paddingTop: `${virtualPaddingTop}px`, paddingBottom: `${virtualPaddingBottom}px` }"
      >
        <!-- 贯穿全图的 Git 竖线 -->
        <div class="absolute left-4 top-2 bottom-2 w-0.5 bg-border/70 -translate-x-1/2 z-0 pointer-events-none" />

        <!-- 时序项列表 -->
        <div
          v-for="item in visibleItems"
          :key="item.id"
          class="relative flex items-start gap-3 py-3 group"
        >
          <!-- Left: Git 小圆点节点 -->
          <div class="relative z-10 flex-shrink-0 flex items-center justify-center w-8 pt-1">
            <div
              class="w-3 h-3 rounded-full border-2 transition-all duration-200 cursor-pointer"
              :class="[
                item.status === 'streaming'
                  ? 'bg-amber-500 border-amber-300 ring-4 ring-amber-500/20 animate-pulse'
                  : item.status === 'error'
                  ? 'bg-destructive border-destructive/50 ring-2 ring-destructive/20'
                  : 'bg-primary border-primary/40 ring-2 ring-primary/20 group-hover:scale-125',
              ]"
              :title="formatEast8Time(item.startTime)"
            />
          </div>

          <!-- Right: 单行指标内容卡片（独立横向滚动） -->
          <div class="flex-1 min-w-0 bg-muted/40 hover:bg-muted/70 border border-border/60 rounded-xl p-2.5 transition-colors">
            <!-- 顶部小行：轮次与东八区时间展示 -->
            <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-border/40 text-[11px]">
              <div class="flex items-center gap-2">
                <span class="font-bold font-mono text-foreground">#{{ item.index }}</span>
                <span
                  class="px-1.5 py-0.2 rounded font-mono text-[10px]"
                  :class="[
                    item.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : item.status === 'streaming'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-destructive/10 text-destructive',
                  ]"
                >
                  {{ item.status === 'completed' ? '完成' : item.status === 'streaming' ? '执行中' : '异常' }}
                </span>
              </div>
              <span class="text-[11px] font-mono text-muted-foreground/80 truncate" :title="formatEast8Time(item.startTime)">
                {{ formatEast8Time(item.startTime) }}
              </span>
            </div>

            <!-- 独立横向滚动胶囊条 (每一个行允许单独的横向滚动) -->
            <div class="flex items-center gap-2 pt-2 overflow-x-auto no-scrollbar whitespace-nowrap text-xs font-mono">
              <!-- TTFT 胶囊 -->
              <div class="px-2 py-0.5 rounded-md bg-card border border-border/50 text-[11px] flex items-center gap-1.5 flex-shrink-0">
                <span class="text-muted-foreground text-[10px] font-sans">首字</span>
                <span class="font-bold text-foreground">
                  {{ item.ttftMs ? `${item.ttftMs}ms` : '--' }}
                </span>
              </div>

              <!-- 含首字 TPS 胶囊 -->
              <div class="px-2 py-0.5 rounded-md bg-card border border-border/50 text-[11px] flex items-center gap-1.5 flex-shrink-0">
                <span class="text-muted-foreground text-[10px] font-sans">含首字</span>
                <span class="font-bold text-foreground">
                  {{ item.tpsWithTtft ? `${item.tpsWithTtft} tps` : '--' }}
                </span>
              </div>

              <!-- 不含首字 TPS 胶囊 -->
              <div class="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[11px] flex items-center gap-1.5 flex-shrink-0">
                <span class="text-primary/70 text-[10px] font-sans">不含首字</span>
                <span class="font-bold">
                  {{ item.tpsWithoutTtft ? `${item.tpsWithoutTtft} tps` : '--' }}
                </span>
              </div>

              <!-- 生成 Token 数量 -->
              <div class="px-2 py-0.5 rounded-md bg-card border border-border/50 text-[11px] flex items-center gap-1.5 flex-shrink-0">
                <span class="text-muted-foreground text-[10px] font-sans">Tokens</span>
                <span class="font-bold text-foreground">{{ item.completionTokens }}</span>
              </div>

              <!-- 耗时 -->
              <div class="px-2 py-0.5 rounded-md bg-card border border-border/50 text-[11px] flex items-center gap-1.5 flex-shrink-0">
                <span class="text-muted-foreground text-[10px] font-sans">耗时</span>
                <span class="font-bold text-foreground">
                  {{ (item.durationMs / 1000).toFixed(2) }}s
                </span>
              </div>

              <!-- 工具调用 -->
              <div
                v-if="item.hasTools"
                class="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[11px] flex items-center gap-1 flex-shrink-0"
              >
                <span class="font-sans text-[10px]">工具:</span>
                <span class="font-semibold">{{ item.toolNames.join(', ') || '已调用' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useTestingStore } from "../../../stores/testing.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import Sheet from "../../../components/ui/Sheet.vue";
import type { RequestMetricItem } from "../../../types/testing.js";

const testingStore = useTestingStore();
const drawerStore = useDrawerStore();

const listContainerRef = ref<HTMLElement | null>(null);

const targetSession = computed(() => {
  if (drawerStore.activeMetricsSessionId && testingStore.sessions[drawerStore.activeMetricsSessionId]) {
    return testingStore.sessions[drawerStore.activeMetricsSessionId];
  }
  return testingStore.activeSlotSession;
});

const currentMetrics = computed(() => {
  if (targetSession.value?.metrics) {
    return targetSession.value.metrics;
  }
  return testingStore.metrics;
});

const sheetTitle = computed(() => {
  if (targetSession.value) {
    return `${targetSession.value.modelName || targetSession.value.modelId} 性能指标`;
  }
  return "测试性能指标与时序分析";
});

const sheetDesc = computed(() => {
  if (targetSession.value) {
    const pName = targetSession.value.providerName || targetSession.value.providerId || "提供商";
    return `${pName} · 单轮微观性能测量、Git 节点时序追踪与双轨吞吐速率`;
  }
  return "单轮微观性能测量、Git 节点时序追踪与双轨吞吐速率";
});

// 全部微观请求指标列表（若当前有活跃请求且未闭合，包含在视图中）
const requestList = computed<RequestMetricItem[]>(() => {
  const session = targetSession.value;
  if (session) {
    const finished = session.metrics.requestMetrics || [];
    if (session.currentRequestMetric && session.currentRequestMetric.status === "streaming") {
      return [...finished, session.currentRequestMetric];
    }
    return finished;
  }
  const finished = testingStore.metrics.requestMetrics || [];
  if (testingStore.currentRequestMetric && testingStore.currentRequestMetric.status === "streaming") {
    return [...finished, testingStore.currentRequestMetric];
  }
  return finished;
});

// 虚拟滚动优化（当轮次超过 30 轮时进行轻量裁剪，保证丝滑流畅）
const virtualPaddingTop = computed(() => 0);
const virtualPaddingBottom = computed(() => 0);
const visibleItems = computed(() => requestList.value);

/**
 * 将时间戳格式化为严谨的东八区 (UTC+8) 格式，精确到毫秒
 */
function formatEast8Time(timestamp: number): string {
  if (!timestamp) return "--";
  const d = new Date(timestamp);
  // 计算东八区标准时间
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const east8 = new Date(utc + 3600000 * 8);

  const y = east8.getFullYear();
  const m = String(east8.getMonth() + 1).padStart(2, "0");
  const day = String(east8.getDate()).padStart(2, "0");
  const h = String(east8.getHours()).padStart(2, "0");
  const min = String(east8.getMinutes()).padStart(2, "0");
  const s = String(east8.getSeconds()).padStart(2, "0");
  const ms = String(east8.getMilliseconds()).padStart(3, "0");

  return `东八区 (UTC+8): ${y}-${m}-${day} ${h}:${min}:${s}.${ms}`;
}

function onOpenChange(val: boolean) {
  if (!val) {
    drawerStore.closeTestMetrics();
  }
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
