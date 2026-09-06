<template>
  <div class="flex-1 min-h-0 w-full overflow-hidden relative select-none">
    <!-- 1. 单卡片布局 (1x1 Single) -->
    <div
      v-if="testingStore.layoutMode === 'single'"
      class="w-full h-full p-3 overflow-hidden"
    >
      <TestCardUnit
        v-if="displayedSessions[0]"
        :session="displayedSessions[0]"
        :slot-index="0"
      />
      <BlankCardUnit v-else :slot-index="0" />
    </div>

    <!-- 2. 双卡片布局 (1x2 Dual) -->
    <div
      v-else-if="testingStore.layoutMode === 'dual'"
      class="w-full h-full grid grid-cols-2 gap-3 p-3 overflow-hidden"
    >
      <template v-for="index in 2" :key="index - 1">
        <TestCardUnit
          v-if="displayedSessions[index - 1]"
          :session="displayedSessions[index - 1]!"
          :slot-index="index - 1"
        />
        <BlankCardUnit v-else :slot-index="index - 1" />
      </template>
    </div>

    <!-- 3. 四宫格布局 (2x2 Quad) -->
    <div
      v-else-if="testingStore.layoutMode === 'quad'"
      class="w-full h-full grid grid-cols-2 grid-rows-2 gap-3 p-3 overflow-hidden"
    >
      <template v-for="index in 4" :key="index - 1">
        <TestCardUnit
          v-if="displayedSessions[index - 1]"
          :session="displayedSessions[index - 1]!"
          :slot-index="index - 1"
        />
        <BlankCardUnit v-else :slot-index="index - 1" />
      </template>
    </div>

    <!-- 4. 多列横向滚动 (Multi-column Horizontal Scroll, Fixed Width 480px) -->
    <div
      v-else-if="testingStore.layoutMode === 'multi-col'"
      class="w-full h-full flex flex-row gap-3 p-3 overflow-x-auto overflow-y-hidden apple-scrollbar items-stretch"
    >
      <div
        v-for="(session, index) in displayedSessions"
        :key="session ? session.id : `blank-slot-${index}`"
        class="w-[480px] h-full flex-shrink-0"
      >
        <TestCardUnit
          v-if="session"
          :session="session"
          :slot-index="index"
        />
        <BlankCardUnit v-else :slot-index="index" />
      </div>

      <!-- Add New Card Slot at end of scroll (Fixed width 480px commensurate to cards) -->
      <div class="w-[480px] h-full flex-shrink-0">
        <button
          type="button"
          class="w-full h-full rounded-2xl border-2 border-dashed border-border/70 hover:border-primary/60 bg-card/30 hover:bg-muted/40 text-muted-foreground hover:text-foreground flex flex-col items-center justify-center gap-3 p-8 transition-all group"
          title="在工作台追加一个空白卡片槽位"
          @click="testingStore.addBlankSlot()"
        >
          <div class="w-12 h-12 rounded-2xl bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all group-hover:scale-110 shadow-xs">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div class="text-center">
            <div class="text-sm font-semibold text-foreground mb-0.5">添加新卡片</div>
            <div class="text-xs text-muted-foreground">在工作台追加一个测试卡片槽位</div>
          </div>
        </button>
      </div>
    </div>

    <!-- 5. 两行多列瀑布 (Two-row Multi-column, Fixed Width 480px) -->
    <div
      v-else-if="testingStore.layoutMode === 'two-row-multi-col'"
      class="w-full h-full grid grid-rows-2 grid-flow-col gap-3 p-3 overflow-x-auto overflow-y-hidden apple-scrollbar"
    >
      <div
        v-for="(session, index) in displayedSessions"
        :key="session ? session.id : `blank-slot-${index}`"
        class="w-[480px] h-full flex-shrink-0 overflow-hidden"
      >
        <TestCardUnit
          v-if="session"
          :session="session"
          :slot-index="index"
        />
        <BlankCardUnit v-else :slot-index="index" />
      </div>

      <!-- Add New Slot in two-row mode (Fixed width 480px commensurate to cards) -->
      <div class="w-[480px] h-full flex-shrink-0">
        <button
          type="button"
          class="w-full h-full rounded-2xl border-2 border-dashed border-border/70 hover:border-primary/60 bg-card/30 hover:bg-muted/40 text-muted-foreground hover:text-foreground flex flex-col items-center justify-center gap-2 p-6 transition-all group"
          title="在工作台追加一个空白卡片槽位"
          @click="testingStore.addBlankSlot()"
        >
          <div class="w-10 h-10 rounded-xl bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all group-hover:scale-110 shadow-xs">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div class="text-center">
            <div class="text-xs font-semibold text-foreground">添加新卡片</div>
            <div class="text-[10px] text-muted-foreground">追加空白测试槽位</div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTestingStore } from "../../../stores/testing.js";
import type { TestSession } from "../../../types/testing.js";
import TestCardUnit from "./TestCardUnit.vue";
import BlankCardUnit from "./BlankCardUnit.vue";

const testingStore = useTestingStore();

const displayedSessions = computed<(TestSession | null)[]>(() => {
  const result: (TestSession | null)[] = [];
  const sids = testingStore.activeSlotSessionIds;

  let targetCount = sids.length;
  if (testingStore.layoutMode === "single") targetCount = 1;
  else if (testingStore.layoutMode === "dual") targetCount = 2;
  else if (testingStore.layoutMode === "quad") targetCount = 4;
  else targetCount = Math.max(1, sids.length);

  for (let i = 0; i < targetCount; i++) {
    const id = sids[i];
    result.push(id && testingStore.sessions[id] ? testingStore.sessions[id] : null);
  }
  return result;
});
</script>
