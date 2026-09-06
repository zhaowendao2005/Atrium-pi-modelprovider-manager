<template>
  <div class="relative inline-flex items-center select-none">
    <!-- SVG Icon Button before header title (User-designated SVG) -->
    <button
      ref="buttonRef"
      type="button"
      class="group relative p-1.5 rounded-xl border border-border/70 bg-card/60 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-150 shadow-xs flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/20"
      :class="{ 'border-primary/40 bg-primary/10 text-primary': isOpen }"
      title="切换工作台布局模式"
      @click="toggleDropdown"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <!-- User Provided SVG Icon -->
      <svg class="w-4 h-4 text-current flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M0 0h24v24H0z" fill="none" />
        <path fill="currentColor" d="M23 6v3h-7V8h-1V1h3v5zm0 9v3h-5v5h-3v-7h1v-1zM8 16h1v7H6v-5H1v-3h7zM9 1v7H8v1H1V6h5V1z" />
      </svg>
    </button>

    <!-- Hover Tooltip Teleported to body -->
    <Teleport to="body">
      <div
        v-if="isHovered && !isOpen"
        class="fixed z-[9999] px-2.5 py-1 text-[11px] font-medium text-foreground bg-popover/95 backdrop-blur-md border border-border/70 rounded-lg shadow-lg pointer-events-none transition-opacity duration-150 animate-in fade-in zoom-in-95"
        :style="tooltipStyle"
      >
        <span>切换工作台布局 (当前: {{ currentLayoutName }})</span>
      </div>
    </Teleport>

    <!-- Teleport Popover Menu to body -->
    <Teleport to="body">
      <!-- Backdrop to close on click outside -->
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[9998]"
        @click="isOpen = false"
      />

      <!-- Popover Menu -->
      <div
        v-if="isOpen"
        class="fixed z-[9999] w-64 rounded-2xl border border-border/70 bg-card/95 backdrop-blur-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 select-none"
        :style="popoverStyle"
      >
        <div class="px-2.5 py-1.5 border-b border-border/50 mb-1 flex items-center justify-between">
          <span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            工作台视图布局
          </span>
          <span class="text-[10px] font-mono text-muted-foreground/80">5 种模式</span>
        </div>

        <div class="space-y-1">
          <button
            v-for="layout in layoutOptions"
            :key="layout.id"
            type="button"
            class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-all duration-150"
            :class="[
              testingStore.layoutMode === layout.id
                ? 'bg-primary/15 text-primary font-medium'
                : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground'
            ]"
            @click="selectLayout(layout.id)"
          >
            <!-- SVG Icon Preview Box -->
            <div
              class="w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0"
              :class="[
                testingStore.layoutMode === layout.id
                  ? 'border-primary/30 bg-primary/20 text-primary'
                  : 'border-border/60 bg-muted/40 text-muted-foreground'
              ]"
            >
              <component :is="layout.icon" class="w-4 h-4" />
            </div>

            <!-- Title & Description -->
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold leading-none mb-1 flex items-center justify-between">
                <span>{{ layout.label }}</span>
                <!-- Checkmark for active layout -->
                <svg
                  v-if="testingStore.layoutMode === layout.id"
                  class="w-3.5 h-3.5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div class="text-[10px] text-muted-foreground truncate">
                {{ layout.desc }}
              </div>
            </div>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, h } from "vue";
import { useTestingStore } from "../../../stores/testing.js";
import type { WorkbenchLayoutMode } from "../../../types/testing.js";

const testingStore = useTestingStore();
const isOpen = ref(false);
const isHovered = ref(false);
const buttonRef = ref<HTMLElement | null>(null);

const popoverStyle = ref({
  top: "0px",
  left: "0px",
});

const tooltipStyle = ref({
  top: "0px",
  left: "0px",
});

function updatePositions() {
  if (!buttonRef.value) return;
  const rect = buttonRef.value.getBoundingClientRect();
  popoverStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(12, rect.left)}px`,
  };
  tooltipStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(12, rect.left)}px`,
  };
}

function onMouseEnter() {
  updatePositions();
  isHovered.value = true;
}

function onMouseLeave() {
  isHovered.value = false;
}

function toggleDropdown() {
  if (!isOpen.value) {
    updatePositions();
    isOpen.value = true;
    isHovered.value = false;
  } else {
    isOpen.value = false;
  }
}

function selectLayout(mode: WorkbenchLayoutMode) {
  testingStore.setLayoutMode(mode);
  isOpen.value = false;
}

function onWindowResizeOrScroll() {
  if (isOpen.value || isHovered.value) {
    updatePositions();
  }
}

onMounted(() => {
  window.addEventListener("resize", onWindowResizeOrScroll);
  window.addEventListener("scroll", onWindowResizeOrScroll, true);
});

onUnmounted(() => {
  window.removeEventListener("resize", onWindowResizeOrScroll);
  window.removeEventListener("scroll", onWindowResizeOrScroll, true);
});

// SVG Icon Renderers for the 5 layout options
const SingleIcon = () =>
  h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
    [h("rect", { x: "4", y: "4", width: "16", height: "16", rx: "3" })]
  );

const DualIcon = () =>
  h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
    [
      h("rect", { x: "3", y: "4", width: "8", height: "16", rx: "2" }),
      h("rect", { x: "13", y: "4", width: "8", height: "16", rx: "2" }),
    ]
  );

const QuadIcon = () =>
  h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
    [
      h("rect", { x: "3", y: "3", width: "8", height: "8", rx: "2" }),
      h("rect", { x: "13", y: "3", width: "8", height: "8", rx: "2" }),
      h("rect", { x: "3", y: "13", width: "8", height: "8", rx: "2" }),
      h("rect", { x: "13", y: "13", width: "8", height: "8", rx: "2" }),
    ]
  );

const MultiColIcon = () =>
  h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
    [
      h("rect", { x: "2", y: "4", width: "5.5", height: "16", rx: "1.5" }),
      h("rect", { x: "9.25", y: "4", width: "5.5", height: "16", rx: "1.5" }),
      h("rect", { x: "16.5", y: "4", width: "5.5", height: "16", rx: "1.5" }),
    ]
  );

const TwoRowMultiColIcon = () =>
  h(
    "svg",
    { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
    [
      h("rect", { x: "2", y: "3", width: "5.5", height: "7.5", rx: "1.5" }),
      h("rect", { x: "2", y: "13.5", width: "5.5", height: "7.5", rx: "1.5" }),
      h("rect", { x: "9.25", y: "3", width: "5.5", height: "7.5", rx: "1.5" }),
      h("rect", { x: "9.25", y: "13.5", width: "5.5", height: "7.5", rx: "1.5" }),
      h("rect", { x: "16.5", y: "3", width: "5.5", height: "7.5", rx: "1.5" }),
      h("rect", { x: "16.5", y: "13.5", width: "5.5", height: "7.5", rx: "1.5" }),
    ]
  );

const layoutOptions = [
  {
    id: "single" as WorkbenchLayoutMode,
    label: "单卡片",
    desc: "1×1 专注独占全屏视界",
    icon: SingleIcon,
  },
  {
    id: "dual" as WorkbenchLayoutMode,
    label: "双卡片横排",
    desc: "1×2 左右两模型实时比对",
    icon: DualIcon,
  },
  {
    id: "quad" as WorkbenchLayoutMode,
    label: "四宫格矩阵",
    desc: "2×2 四模型全景评测矩阵",
    icon: QuadIcon,
  },
  {
    id: "multi-col" as WorkbenchLayoutMode,
    label: "多列横向滚动",
    desc: "单行自适应固定宽无限横排",
    icon: MultiColIcon,
  },
  {
    id: "two-row-multi-col" as WorkbenchLayoutMode,
    label: "两行多列瀑布",
    desc: "双行多列横向滚动平铺",
    icon: TwoRowMultiColIcon,
  },
];

const currentLayoutName = computed(() => {
  const opt = layoutOptions.find((o) => o.id === testingStore.layoutMode);
  return opt ? opt.label : "单卡片";
});
</script>
