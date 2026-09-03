<template>
  <div class="relative w-full h-full flex flex-col overflow-hidden select-none">
    <!-- Virtual Scroll Viewport Container (with Apple-style Sleek Scrollbar) -->
    <div
      ref="containerRef"
      class="w-full flex-1 overflow-y-auto overflow-x-hidden apple-scrollbar px-6 py-4"
      @scroll="handleScroll"
    >
      <!-- Empty State -->
      <div
        v-if="messages.length === 0"
        class="h-full min-h-[320px] flex flex-col items-center justify-center text-center text-muted-foreground"
      >
        <div class="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
          <svg class="w-6 h-6 text-muted-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p class="text-sm font-semibold text-foreground">暂无消息流</p>
        <p class="text-xs text-muted-foreground mt-1 max-w-sm">
          点击底部操作控制台的「执行测试」开始模拟流式传输与工具调用验证。
        </p>
      </div>

      <!-- Virtual Scrolling Spacer & Window -->
      <div v-else :style="{ paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px` }">
        <div
          v-for="item in visibleItems"
          :key="item.message.id"
          :ref="(el) => registerItemRef(item.message.id, el as HTMLElement | null)"
          class="min-h-[48px]"
        >
          <MessageItem :message="item.message" />
        </div>
      </div>
    </div>

    <!-- Scroll-to-Bottom Floating Button (Appears when scrolled up) -->
    <div
      v-if="!isPinnedToBottom && messages.length > 0"
      class="absolute bottom-4 right-6 z-10"
    >
      <button
        type="button"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-md border border-border shadow-lg shadow-black/10 text-xs font-medium text-foreground hover:bg-accent transition-all active:scale-95"
        @click="scrollToBottom(true)"
      >
        <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        <span>回到底部</span>
        <span
          v-if="hasNewContentWhileScrolled"
          class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import type { UIMessage } from "../../../types/testing.js";
import MessageItem from "./MessageItem.vue";

const props = defineProps<{
  messages: UIMessage[];
}>();

const containerRef = ref<HTMLElement | null>(null);

// 虚拟滚动参数
const DEFAULT_ITEM_HEIGHT = 90;
const OVERSCAN = 4;

const scrollTop = ref(0);
const viewportHeight = ref(600);
const isPinnedToBottom = ref(true);
const hasNewContentWhileScrolled = ref(false);

// 动态高度缓存 (message.id -> height)
const itemHeightMap = new Map<string, number>();
const itemElements = new Map<string, HTMLElement>();
let resizeObserver: ResizeObserver | null = null;

function registerItemRef(id: string, el: HTMLElement | null) {
  if (!el) {
    itemElements.delete(id);
    return;
  }
  itemElements.set(id, el);
  if (resizeObserver) {
    resizeObserver.observe(el);
  }
}

function getItemHeight(id: string): number {
  return itemHeightMap.get(id) || DEFAULT_ITEM_HEIGHT;
}

// 计算各消息的偏移量位置
const itemPositions = computed(() => {
  const positions: Array<{ id: string; top: number; bottom: number; height: number }> = [];
  let currentTop = 0;

  for (const msg of props.messages) {
    const h = getItemHeight(msg.id);
    positions.push({
      id: msg.id,
      top: currentTop,
      bottom: currentTop + h,
      height: h,
    });
    currentTop += h;
  }

  return positions;
});

// 计算可视区域 [startIndex, endIndex]
const virtualRange = computed(() => {
  const total = props.messages.length;
  if (total === 0) return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 };

  // 渐进式虚拟滚动：当消息总数在 40 条以内时，直接全量渲染，避免因流式内容快速扩张导致的高度测量异步截断
  if (total <= 40) {
    return { start: 0, end: total - 1, paddingTop: 0, paddingBottom: 0 };
  }

  // 超过 40 条时，启动高效虚拟窗口裁剪
  const positions = itemPositions.value;
  const targetTop = scrollTop.value;
  const targetBottom = targetTop + viewportHeight.value;

  let start = 0;
  let end = total - 1;

  for (let i = 0; i < total; i++) {
    if (positions[i].bottom >= targetTop) {
      start = Math.max(0, i - OVERSCAN);
      break;
    }
  }

  for (let i = start; i < total; i++) {
    if (positions[i].top > targetBottom) {
      end = Math.min(total - 1, i + OVERSCAN);
      break;
    }
  }

  const paddingTop = positions[start]?.top || 0;
  const totalHeight = positions[total - 1]?.bottom || 0;
  const paddingBottom = Math.max(0, totalHeight - (positions[end]?.bottom || 0));

  return {
    start,
    end,
    paddingTop,
    paddingBottom,
  };
});

const paddingTop = computed(() => virtualRange.value.paddingTop);
const paddingBottom = computed(() => virtualRange.value.paddingBottom);

const visibleItems = computed(() => {
  const { start, end } = virtualRange.value;
  return props.messages.slice(start, end + 1).map((msg, index) => ({
    message: msg,
    index: start + index,
  }));
});

// 滚动监听与粘性控制
let rAFScrollId: number | null = null;
function handleScroll() {
  if (rAFScrollId) cancelAnimationFrame(rAFScrollId);
  rAFScrollId = requestAnimationFrame(() => {
    const el = containerRef.value;
    if (!el) return;

    scrollTop.value = el.scrollTop;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    // 若距离底部小于 60px，视为处于底部
    const atBottom = distanceToBottom < 60;
    isPinnedToBottom.value = atBottom;
    if (atBottom) {
      hasNewContentWhileScrolled.value = false;
    }
  });
}

function scrollToBottom(smooth = false) {
  nextTick(() => {
    const el = containerRef.value;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    isPinnedToBottom.value = true;
    hasNewContentWhileScrolled.value = false;
  });
}

// 当消息列表内容变动或正在流式输出时自动跟进
watch(
  () => props.messages,
  () => {
    if (isPinnedToBottom.value) {
      scrollToBottom(false);
    } else {
      hasNewContentWhileScrolled.value = true;
    }
  },
  { deep: true }
);

onMounted(() => {
  if (containerRef.value) {
    viewportHeight.value = containerRef.value.clientHeight;
  }

  resizeObserver = new ResizeObserver((entries) => {
    let hasHeightChange = false;
    for (const entry of entries) {
      const target = entry.target as HTMLElement;
      for (const [id, el] of itemElements.entries()) {
        if (el === target) {
          const newHeight = Math.ceil(entry.contentRect.height);
          if (newHeight > 0 && itemHeightMap.get(id) !== newHeight) {
            itemHeightMap.set(id, newHeight);
            hasHeightChange = true;
          }
          break;
        }
      }
    }
    if (hasHeightChange && isPinnedToBottom.value) {
      scrollToBottom(false);
    }
  });

  const onWindowResize = () => {
    if (containerRef.value) {
      viewportHeight.value = containerRef.value.clientHeight;
    }
  };
  window.addEventListener("resize", onWindowResize);

  scrollToBottom(false);
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (rAFScrollId) {
    cancelAnimationFrame(rAFScrollId);
  }
});
</script>
