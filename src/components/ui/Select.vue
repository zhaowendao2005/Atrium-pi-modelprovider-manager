<template>
  <div class="relative w-full" :class="props.class">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      type="button"
      :disabled="props.disabled"
      :class="[
        sizeTriggerClass,
        isOpen
          ? 'ring-2 ring-primary/30 border-primary bg-background dark:bg-slate-800 shadow-sm'
          : 'bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 border-slate-200/80 dark:border-slate-700/80',
        props.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
      ]"
      class="w-full flex items-center justify-between gap-2 border text-left transition-all duration-150 outline-none select-none active:scale-[0.99]"
      @click="toggleOpen"
      @keydown="handleTriggerKeyDown"
    >
      <!-- Label / Placeholder -->
      <span
        class="truncate flex-1 min-w-0"
        :class="[
          selectedOption ? 'text-foreground font-normal' : 'text-muted-foreground',
          props.size === 'sm' ? 'text-xs' : 'text-sm',
        ]"
      >
        {{ currentDisplayLabel }}
      </span>

      <!-- iOS Chevron SVG Icon -->
      <div
        class="flex-shrink-0 text-muted-foreground transition-transform duration-200 flex items-center justify-center"
        :class="[isOpen ? 'rotate-180 text-primary' : '']"
      >
        <svg
          :class="props.size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>

    <!-- iOS Dropdown Menu Popover (Teleported to body) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isOpen"
          ref="floatingRef"
          :style="floatingStyles"
          :class="[
            placement === 'top' ? 'origin-bottom' : 'origin-top',
          ]"
          class="fixed z-[70] backdrop-blur-xl bg-card/95 dark:bg-slate-900/95 border border-border/80 dark:border-slate-700/80 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/50 p-1.5 flex flex-col gap-1 select-none outline-none ring-1 ring-black/5 dark:ring-white/10 overflow-hidden"
          @keydown="handleMenuKeyDown"
        >
          <!-- Optional Search Bar -->
          <div
            v-if="showSearch"
            class="px-1.5 pt-1 pb-1.5 border-b border-border/40 flex items-center flex-shrink-0"
          >
            <div class="relative w-full flex items-center">
              <svg
                class="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                placeholder="快速搜索..."
                class="w-full bg-muted/60 hover:bg-muted/90 focus:bg-background rounded-xl pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 border border-transparent focus:border-primary/40 focus:ring-1 focus:ring-primary/40 outline-none transition-all"
                @click.stop
              />
              <button
                v-if="searchQuery"
                type="button"
                class="absolute right-2 p-0.5 text-muted-foreground hover:text-foreground rounded-full"
                @click.stop="searchQuery = ''"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Options Scroll Area with Custom Apple Scrollbar -->
          <div
            class="relative flex-1 min-h-0 overflow-hidden"
            @mouseenter="isHovered = true"
            @mouseleave="isHovered = false"
          >
            <!-- Native-Feel Smooth Scroll Viewport -->
            <div
              ref="listContainerRef"
              :style="{ maxHeight: listMaxHeight }"
              class="w-full overflow-y-auto overscroll-contain select-none outline-none no-scrollbar flex flex-col gap-0.5 p-0.5"
              @scroll="handleListScroll"
            >
              <!-- Empty Search Results -->
              <div
                v-if="filteredOptions.length === 0"
                class="py-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5"
              >
                <svg class="w-5 h-5 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>未找到匹配项</span>
              </div>

              <!-- Option Items -->
              <div
                v-for="(opt, idx) in filteredOptions"
                :key="opt.value"
                :ref="el => registerOptionRef(el, idx)"
                :class="[
                  sizeOptionClass,
                  opt.disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
                  isSelected(opt)
                    ? 'bg-primary/10 text-primary font-medium'
                    : highlightedIndex === idx
                    ? 'bg-accent/80 text-accent-foreground'
                    : 'text-foreground hover:bg-muted/70 active:bg-muted',
                ]"
                class="transition-colors flex items-center justify-between gap-3 group rounded-xl"
                @click="selectOption(opt)"
                @mouseenter="highlightedIndex = idx"
              >
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="truncate leading-snug">{{ opt.label }}</span>
                  <span
                    v-if="opt.description"
                    class="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight group-hover:text-muted-foreground/90"
                  >
                    {{ opt.description }}
                  </span>
                </div>

                <!-- Checkmark Icon for Selected -->
                <div v-if="isSelected(opt)" class="flex-shrink-0 text-primary pl-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>

            <!-- Apple-Style Smooth Floating Scrollbar Thumb -->
            <div
              v-if="hasVerticalScroll"
              class="absolute right-0.5 top-1 bottom-1 w-1.5 transition-opacity duration-300 pointer-events-none z-10"
              :class="[
                isScrolling || isHovered || isDraggingThumb
                  ? 'opacity-100'
                  : 'opacity-0',
              ]"
            >
              <div
                class="w-full bg-slate-400/40 dark:bg-slate-500/40 rounded-full cursor-pointer pointer-events-auto hover:bg-slate-500/70 dark:hover:bg-slate-400/70 transition-colors"
                :style="{
                  height: `${thumbHeight}px`,
                  transform: `translateY(${thumbTop}px)`,
                }"
                @mousedown.prevent="startThumbDrag"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, type CSSProperties } from "vue";

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface Props {
  modelValue?: string | number;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  searchable?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder: "请选择...",
  disabled: false,
  size: "md",
  searchable: undefined,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "change", value: string): void;
}>();

const isOpen = ref(false);
const searchQuery = ref("");
const highlightedIndex = ref(-1);
const placement = ref<"bottom" | "top">("bottom");
const listMaxHeight = ref("250px");

const triggerRef = ref<HTMLButtonElement | null>(null);
const floatingRef = ref<HTMLDivElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const listContainerRef = ref<HTMLDivElement | null>(null);
const optionEls = ref<HTMLElement[]>([]);

// Custom Apple Scrollbar States
const hasVerticalScroll = ref(false);
const thumbHeight = ref(20);
const thumbTop = ref(0);
const isHovered = ref(false);
const isScrolling = ref(false);
const isDraggingThumb = ref(false);
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let startDragY = 0;
let startThumbTop = 0;
let listResizeObserver: ResizeObserver | null = null;

function registerOptionRef(el: any, idx: number) {
  if (el) {
    optionEls.value[idx] = el as HTMLElement;
  }
}

const floatingStyles = ref<CSSProperties>({});

const sizeTriggerClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "h-7 px-2.5 py-1 text-xs rounded-lg";
    case "lg":
      return "h-11 px-4 py-2.5 text-sm rounded-xl";
    case "md":
    default:
      return "h-9 px-3.5 py-1.5 text-sm rounded-xl";
  }
});

const sizeOptionClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "px-2.5 py-1.5 text-xs rounded-lg";
    case "lg":
      return "px-3.5 py-2.5 text-sm rounded-xl";
    case "md":
    default:
      return "px-3 py-2 text-sm rounded-xl";
  }
});

const selectedOption = computed(() => {
  return props.options.find(
    opt => String(opt.value) === String(props.modelValue)
  );
});

const currentDisplayLabel = computed(() => {
  if (selectedOption.value) {
    return selectedOption.value.label;
  }
  return props.placeholder || "请选择...";
});

const showSearch = computed(() => {
  if (props.searchable !== undefined) return props.searchable;
  return props.options.length > 7;
});

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter(opt => {
    return (
      opt.label.toLowerCase().includes(q) ||
      String(opt.value).toLowerCase().includes(q) ||
      (opt.description && opt.description.toLowerCase().includes(q))
    );
  });
});

function isSelected(opt: SelectOption) {
  return String(opt.value) === String(props.modelValue);
}

// === Scroll Metrics Calculation ===
function updateScrollMetrics() {
  const el = listContainerRef.value;
  if (!el) {
    hasVerticalScroll.value = false;
    return;
  }

  const { clientHeight, scrollHeight, scrollTop } = el;
  hasVerticalScroll.value = scrollHeight > clientHeight + 2;

  if (hasVerticalScroll.value) {
    const minHeight = 24;
    const computedHeight = Math.max(minHeight, (clientHeight / scrollHeight) * clientHeight);
    thumbHeight.value = computedHeight;
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - computedHeight;
    thumbTop.value = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;
  }
}

function handleListScroll() {
  updateScrollMetrics();
  isScrolling.value = true;
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    isScrolling.value = false;
  }, 900);
}

// === Scrollbar Drag Handling ===
function startThumbDrag(e: MouseEvent) {
  isDraggingThumb.value = true;
  startDragY = e.clientY;
  startThumbTop = thumbTop.value;
  window.addEventListener("mousemove", onThumbDrag);
  window.addEventListener("mouseup", stopThumbDrag);
}

function onThumbDrag(e: MouseEvent) {
  if (!isDraggingThumb.value || !listContainerRef.value) return;
  const el = listContainerRef.value;
  const deltaY = e.clientY - startDragY;
  const { clientHeight, scrollHeight } = el;
  const maxThumbTop = clientHeight - thumbHeight.value;
  const newThumbTop = Math.min(Math.max(0, startThumbTop + deltaY), maxThumbTop);

  const scrollRatio = maxThumbTop > 0 ? newThumbTop / maxThumbTop : 0;
  el.scrollTop = scrollRatio * (scrollHeight - clientHeight);
}

function stopThumbDrag() {
  isDraggingThumb.value = false;
  window.removeEventListener("mousemove", onThumbDrag);
  window.removeEventListener("mouseup", stopThumbDrag);
}

// === Viewport Collision & Positioning ===
function updatePosition() {
  if (!isOpen.value || !triggerRef.value) return;

  const rect = triggerRef.value.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // If trigger scrolled completely out of viewport, close
  if (rect.bottom < 0 || rect.top > windowHeight) {
    isOpen.value = false;
    return;
  }

  const spaceBelow = windowHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  const openUpwards = spaceBelow < 220 && spaceAbove > spaceBelow;
  placement.value = openUpwards ? "top" : "bottom";

  const availableSpace = openUpwards ? spaceAbove : spaceBelow;
  const maxPopoverHeight = Math.min(380, Math.max(160, availableSpace));
  const searchHeight = showSearch.value ? 48 : 0;
  listMaxHeight.value = `${Math.max(100, maxPopoverHeight - searchHeight - 20)}px`;

  const minWidth = Math.max(rect.width, props.size === "sm" ? 140 : 220);
  let left = rect.left;
  if (left + minWidth > windowWidth - 12) {
    left = Math.max(12, windowWidth - minWidth - 12);
  }

  floatingStyles.value = {
    position: "fixed",
    left: `${left}px`,
    top: openUpwards ? "auto" : `${rect.bottom + 6}px`,
    bottom: openUpwards ? `${windowHeight - rect.top + 6}px` : "auto",
    width: `${Math.max(rect.width, minWidth)}px`,
    maxWidth: `${Math.min(windowWidth - 24, 460)}px`,
  };
}

function toggleOpen() {
  if (props.disabled) return;
  if (isOpen.value) {
    closeMenu();
  } else {
    openMenu();
  }
}

function openMenu() {
  isOpen.value = true;
  searchQuery.value = "";
  optionEls.value = [];

  const currIdx = filteredOptions.value.findIndex(isSelected);
  highlightedIndex.value = currIdx >= 0 ? currIdx : 0;

  nextTick(() => {
    updatePosition();
    if (showSearch.value && searchInputRef.value) {
      searchInputRef.value.focus();
    }

    // Initialize ResizeObserver on the scrollable container
    if (listContainerRef.value) {
      if (listResizeObserver) listResizeObserver.disconnect();
      listResizeObserver = new ResizeObserver(() => updateScrollMetrics());
      listResizeObserver.observe(listContainerRef.value);
    }

    // Scroll active item smoothly into center view
    if (currIdx >= 0 && optionEls.value[currIdx] && listContainerRef.value) {
      const el = optionEls.value[currIdx];
      const container = listContainerRef.value;
      const targetScroll = el.offsetTop - (container.clientHeight / 2) + (el.offsetHeight / 2);
      container.scrollTop = Math.max(0, targetScroll);
    }
    updateScrollMetrics();
  });
}

function closeMenu() {
  isOpen.value = false;
  searchQuery.value = "";
  highlightedIndex.value = -1;
  if (listResizeObserver) {
    listResizeObserver.disconnect();
    listResizeObserver = null;
  }
  if (scrollTimer) {
    clearTimeout(scrollTimer);
    scrollTimer = null;
  }
  stopThumbDrag();
}

function selectOption(opt: SelectOption) {
  if (opt.disabled) return;
  emit("update:modelValue", opt.value);
  emit("change", opt.value);
  closeMenu();
  triggerRef.value?.focus();
}

function handleTriggerKeyDown(e: KeyboardEvent) {
  if (props.disabled) return;
  if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
    e.preventDefault();
    openMenu();
  }
}

function handleMenuKeyDown(e: KeyboardEvent) {
  const count = filteredOptions.value.length;
  if (count === 0) {
    if (e.key === "Escape") {
      closeMenu();
      triggerRef.value?.focus();
    }
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    highlightedIndex.value = (highlightedIndex.value + 1) % count;
    scrollToHighlighted();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    highlightedIndex.value = (highlightedIndex.value - 1 + count) % count;
    scrollToHighlighted();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (highlightedIndex.value >= 0 && highlightedIndex.value < count) {
      selectOption(filteredOptions.value[highlightedIndex.value]);
    }
  } else if (e.key === "Escape" || e.key === "Tab") {
    closeMenu();
    triggerRef.value?.focus();
  }
}

function scrollToHighlighted() {
  nextTick(() => {
    const el = optionEls.value[highlightedIndex.value];
    const container = listContainerRef.value;
    if (el && container) {
      const elTop = el.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      const containerTop = container.scrollTop;
      const containerBottom = containerTop + container.clientHeight;

      if (elTop < containerTop) {
        container.scrollTop = elTop;
      } else if (elBottom > containerBottom) {
        container.scrollTop = elBottom - container.clientHeight;
      }
      updateScrollMetrics();
    }
  });
}

function handleGlobalPointerDown(e: PointerEvent) {
  if (!isOpen.value) return;
  const target = e.target as Node;
  if (
    triggerRef.value?.contains(target) ||
    floatingRef.value?.contains(target)
  ) {
    return;
  }
  closeMenu();
}

function handleGlobalScroll(e: Event) {
  if (!isOpen.value) return;
  // If the scroll event originated from inside our own popover, do nothing
  if (floatingRef.value && (floatingRef.value === e.target || floatingRef.value.contains(e.target as Node))) {
    return;
  }
  updatePosition();
}

function handleGlobalResize() {
  if (isOpen.value) {
    updatePosition();
  }
}

watch(isOpen, val => {
  if (val) {
    window.addEventListener("pointerdown", handleGlobalPointerDown, true);
    window.addEventListener("scroll", handleGlobalScroll, true);
    window.addEventListener("resize", handleGlobalResize);
  } else {
    window.removeEventListener("pointerdown", handleGlobalPointerDown, true);
    window.removeEventListener("scroll", handleGlobalScroll, true);
    window.removeEventListener("resize", handleGlobalResize);
  }
});

watch(searchQuery, () => {
  highlightedIndex.value = filteredOptions.value.length > 0 ? 0 : -1;
  nextTick(() => {
    if (listContainerRef.value) {
      listContainerRef.value.scrollTop = 0;
    }
    updatePosition();
    updateScrollMetrics();
  });
});

onMounted(() => {
  // Clean initialization
});

onUnmounted(() => {
  closeMenu();
  window.removeEventListener("pointerdown", handleGlobalPointerDown, true);
  window.removeEventListener("scroll", handleGlobalScroll, true);
  window.removeEventListener("resize", handleGlobalResize);
});
</script>
