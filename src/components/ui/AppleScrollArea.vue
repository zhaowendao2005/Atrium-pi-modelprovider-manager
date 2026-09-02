<template>
  <div
    class="relative overflow-hidden group/scroll-area"
    :class="props.class"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- 内部滚动视口 (隐藏原生滚动条) -->
    <div
      ref="viewportRef"
      class="w-full h-full overflow-auto no-scrollbar"
      @scroll="handleScroll"
    >
      <slot />
    </div>

    <!-- 纵向滚动条轨道与滑块 -->
    <div
      v-if="hasVerticalScroll"
      class="absolute right-1 top-1 bottom-1 w-1.5 transition-opacity duration-300 pointer-events-none"
      :class="[
        isScrolling || isHovered || isDraggingVertical
          ? 'opacity-100'
          : 'opacity-0',
      ]"
    >
      <div
        class="w-full bg-slate-400/40 dark:bg-slate-500/40 rounded-full cursor-pointer pointer-events-auto hover:bg-slate-500/60 dark:hover:bg-slate-400/60 transition-colors"
        :style="{
          height: `${thumbHeight}px`,
          transform: `translateY(${thumbTop}px)`,
        }"
        @mousedown.prevent="startVerticalDrag"
      />
    </div>

    <!-- 横向滚动条轨道与滑块 -->
    <div
      v-if="hasHorizontalScroll"
      class="absolute left-1 right-1 bottom-1 h-1.5 transition-opacity duration-300 pointer-events-none"
      :class="[
        isScrolling || isHovered || isDraggingHorizontal
          ? 'opacity-100'
          : 'opacity-0',
      ]"
    >
      <div
        class="h-full bg-slate-400/40 dark:bg-slate-500/40 rounded-full cursor-pointer pointer-events-auto hover:bg-slate-500/60 dark:hover:bg-slate-400/60 transition-colors"
        :style="{
          width: `${thumbWidth}px`,
          transform: `translateX(${thumbLeft}px)`,
        }"
        @mousedown.prevent="startHorizontalDrag"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps<{
  class?: string;
}>();

const viewportRef = ref<HTMLDivElement | null>(null);

const hasVerticalScroll = ref(false);
const hasHorizontalScroll = ref(false);

const thumbHeight = ref(20);
const thumbTop = ref(0);

const thumbWidth = ref(20);
const thumbLeft = ref(0);

const isHovered = ref(false);
const isScrolling = ref(false);
const isDraggingVertical = ref(false);
const isDraggingHorizontal = ref(false);

let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let startY = 0;
let startThumbTop = 0;
let startX = 0;
let startThumbLeft = 0;

function updateMetrics() {
  const el = viewportRef.value;
  if (!el) return;

  const { clientHeight, scrollHeight, clientWidth, scrollWidth, scrollTop, scrollLeft } = el;

  // 垂直计算
  hasVerticalScroll.value = scrollHeight > clientHeight + 1;
  if (hasVerticalScroll.value) {
    const minHeight = 24;
    const computedHeight = Math.max(minHeight, (clientHeight / scrollHeight) * clientHeight);
    thumbHeight.value = computedHeight;
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - computedHeight;
    thumbTop.value = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;
  }

  // 水平计算
  hasHorizontalScroll.value = scrollWidth > clientWidth + 1;
  if (hasHorizontalScroll.value) {
    const minWidth = 24;
    const computedWidth = Math.max(minWidth, (clientWidth / scrollWidth) * clientWidth);
    thumbWidth.value = computedWidth;
    const maxScrollLeft = scrollWidth - clientWidth;
    const maxThumbLeft = clientWidth - computedWidth;
    thumbLeft.value = maxScrollLeft > 0 ? (scrollLeft / maxScrollLeft) * maxThumbLeft : 0;
  }
}

function handleScroll() {
  updateMetrics();
  isScrolling.value = true;
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    isScrolling.value = false;
  }, 1000);
}

function startVerticalDrag(e: MouseEvent) {
  isDraggingVertical.value = true;
  startY = e.clientY;
  startThumbTop = thumbTop.value;
  window.addEventListener("mousemove", onVerticalDrag);
  window.addEventListener("mouseup", stopVerticalDrag);
}

function onVerticalDrag(e: MouseEvent) {
  if (!isDraggingVertical.value || !viewportRef.value) return;
  const el = viewportRef.value;
  const deltaY = e.clientY - startY;
  const { clientHeight, scrollHeight } = el;
  const maxThumbTop = clientHeight - thumbHeight.value;
  const newThumbTop = Math.min(Math.max(0, startThumbTop + deltaY), maxThumbTop);

  const scrollRatio = newThumbTop / maxThumbTop;
  el.scrollTop = scrollRatio * (scrollHeight - clientHeight);
}

function stopVerticalDrag() {
  isDraggingVertical.value = false;
  window.removeEventListener("mousemove", onVerticalDrag);
  window.removeEventListener("mouseup", stopVerticalDrag);
}

function startHorizontalDrag(e: MouseEvent) {
  isDraggingHorizontal.value = true;
  startX = e.clientX;
  startThumbLeft = thumbLeft.value;
  window.addEventListener("mousemove", onHorizontalDrag);
  window.addEventListener("mouseup", stopHorizontalDrag);
}

function onHorizontalDrag(e: MouseEvent) {
  if (!isDraggingHorizontal.value || !viewportRef.value) return;
  const el = viewportRef.value;
  const deltaX = e.clientX - startX;
  const { clientWidth, scrollWidth } = el;
  const maxThumbLeft = clientWidth - thumbWidth.value;
  const newThumbLeft = Math.min(Math.max(0, startThumbLeft + deltaX), maxThumbLeft);

  const scrollRatio = newThumbLeft / maxThumbLeft;
  el.scrollLeft = scrollRatio * (scrollWidth - clientWidth);
}

function stopHorizontalDrag() {
  isDraggingHorizontal.value = false;
  window.removeEventListener("mousemove", onHorizontalDrag);
  window.removeEventListener("mouseup", stopHorizontalDrag);
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => {
    updateMetrics();
    if (viewportRef.value) {
      resizeObserver = new ResizeObserver(() => updateMetrics());
      resizeObserver.observe(viewportRef.value);
    }
  });
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  if (scrollTimer) clearTimeout(scrollTimer);
  stopVerticalDrag();
  stopHorizontalDrag();
});
</script>
