<template>
  <div class="w-80 h-full border-r border-border/60 bg-card/40 backdrop-blur-md flex flex-col flex-shrink-0 select-none overflow-hidden">
    <!-- Top Action Bar: Header Title, New Test Button, Filter & Search -->
    <div class="p-3 border-b border-border/50 flex flex-col gap-2.5 flex-shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-xs font-bold text-foreground">测试历史库</span>
          <span
            v-if="totalSessionsCount > 0"
            class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
          >
            {{ totalSessionsCount }}
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          <!-- Filter Popover Trigger Button -->
          <button
            type="button"
            class="p-1.5 rounded-lg border border-border/60 hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all duration-150 relative"
            :class="{ 'border-primary/40 bg-primary/10 text-primary': isFilterActive }"
            title="筛选测试记录"
            @click="isFilterOpen = !isFilterOpen"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span v-if="isFilterActive" class="w-1.5 h-1.5 rounded-full bg-primary absolute top-1 right-1" />
          </button>

          <!-- New Test Wizard Modal Trigger -->
          <button
            type="button"
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-all shadow-xs"
            title="发起全新测试会话或批量评测"
            @click="drawerStore.openLauncherModal()"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>新建测试</span>
          </button>
        </div>
      </div>

      <!-- Search Input -->
      <div class="relative w-full">
        <svg class="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="testingStore.historyFilter.searchQuery"
          type="text"
          placeholder="搜索组名、模型或提供商..."
          class="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/60 rounded-xl placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50 text-foreground"
        />
      </div>

      <!-- Filter Dropdown Panel (Collapsible) -->
      <div
        v-if="isFilterOpen"
        class="p-2.5 rounded-xl border border-border/70 bg-card/95 backdrop-blur-md shadow-lg space-y-2 text-xs animate-in fade-in zoom-in-95 duration-100"
      >
        <div class="flex items-center justify-between font-semibold text-[11px] text-muted-foreground pb-1 border-b border-border/40">
          <span>筛选选项</span>
          <button
            v-if="isFilterActive"
            type="button"
            class="text-primary hover:underline text-[10px]"
            @click="resetFilter"
          >
            清空筛选
          </button>
        </div>

        <!-- Filter by Task -->
        <div class="flex items-center justify-between gap-2">
          <span class="text-muted-foreground text-[11px] whitespace-nowrap">任务模板:</span>
          <select
            v-model="testingStore.historyFilter.taskId"
            class="flex-1 text-[11px] bg-muted/50 border border-border/60 rounded-lg px-2 py-1 text-foreground focus:outline-none"
          >
            <option value="all">全部任务场景</option>
            <option v-for="t in testingStore.tasks" :key="t.id" :value="t.id">
              {{ t.name }}
            </option>
          </select>
        </div>

        <!-- Filter by Status -->
        <div class="flex items-center justify-between gap-2">
          <span class="text-muted-foreground text-[11px] whitespace-nowrap">执行状态:</span>
          <select
            v-model="testingStore.historyFilter.status"
            class="flex-1 text-[11px] bg-muted/50 border border-border/60 rounded-lg px-2 py-1 text-foreground focus:outline-none"
          >
            <option value="all">全部状态</option>
            <option value="running">运行中 (Running)</option>
            <option value="completed">已完成 (Completed)</option>
            <option value="failed">失败 (Failed)</option>
            <option value="stopped">已中止 (Stopped)</option>
            <option value="idle">待测试 (Idle)</option>
          </select>
        </div>

        <!-- Filter by Date -->
        <div class="flex items-center justify-between gap-2">
          <span class="text-muted-foreground text-[11px] whitespace-nowrap">时间范围:</span>
          <select
            v-model="testingStore.historyFilter.dateRange"
            class="flex-1 text-[11px] bg-muted/50 border border-border/60 rounded-lg px-2 py-1 text-foreground focus:outline-none"
          >
            <option value="all">全部时间</option>
            <option value="today">今天</option>
            <option value="week">最近 7 天</option>
            <option value="month">最近 30 天</option>
          </select>
        </div>
      </div>
    </div>

    <!-- History Tree / List Area -->
    <div class="flex-1 overflow-y-auto p-2 space-y-2 apple-scrollbar">
      <!-- Empty State -->
      <div
        v-if="testingStore.filteredHistoryGroups.length === 0 && standaloneSessions.length === 0"
        class="h-48 flex flex-col items-center justify-center text-center text-muted-foreground px-4"
      >
        <svg class="w-8 h-8 text-muted-foreground/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p class="text-xs font-medium text-foreground">暂无测试记录</p>
        <p class="text-[11px] text-muted-foreground mt-1">
          点击上方「新建测试」发起单模型或批量评测
        </p>
      </div>

      <!-- Section 1: Groups Tree -->
      <div v-if="testingStore.filteredHistoryGroups.length > 0" class="space-y-1.5">
        <div class="px-2 py-1 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
          测试组 ({{ testingStore.filteredHistoryGroups.length }})
        </div>

        <div
          v-for="group in testingStore.filteredHistoryGroups"
          :key="group.id"
          class="rounded-xl border transition-all duration-150 overflow-hidden"
          :class="[
            testingStore.activeGroupId === group.id
              ? 'border-primary/50 bg-primary/5'
              : 'border-border/50 bg-card/50 hover:bg-muted/50'
          ]"
        >
          <!-- Group Item Row -->
          <div
            class="px-2.5 py-2 flex items-center justify-between gap-2 cursor-pointer group/item"
            @click="testingStore.selectGroup(group.id)"
            @contextmenu.prevent="openContextMenu($event, 'group', group)"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <!-- Expand / Collapse Arrow -->
              <button
                type="button"
                class="p-0.5 text-muted-foreground hover:text-foreground"
                @click.stop="toggleGroupExpand(group.id)"
              >
                <svg
                  class="w-3 h-3 transition-transform duration-150"
                  :class="{ 'rotate-90': expandedGroupIds.has(group.id) }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-semibold text-foreground truncate" :title="group.name">
                    {{ group.name }}
                  </span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                    {{ getGroupSessions(group.id).length }}
                  </span>
                </div>
                <div class="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{{ formatLayoutName(group.layoutMode) }}</span>
                  <span>·</span>
                  <span>{{ formatTimeAgo(group.createdAt) }}</span>
                </div>
              </div>
            </div>

            <!-- Group Actions (Delete on hover) -->
            <button
              type="button"
              class="opacity-0 group-hover/item:opacity-100 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              title="删除测试组"
              @click.stop="testingStore.deleteGroup(group.id)"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          <!-- Group Child Sessions List (Expanded) -->
          <div
            v-if="expandedGroupIds.has(group.id)"
            class="pl-6 pr-2 py-1 space-y-1 bg-muted/20 border-t border-border/40"
          >
            <div
              v-for="session in getGroupSessions(group.id)"
              :key="session.id"
              class="px-2 py-1.5 rounded-lg flex items-center justify-between gap-1.5 cursor-pointer text-xs transition-all"
              :class="[
                testingStore.activeSlotSession?.id === session.id
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-foreground/80 hover:bg-muted/60'
              ]"
              @click="testingStore.selectSession(session.id)"
              @contextmenu.prevent="openContextMenu($event, 'session', session)"
            >
              <div class="flex items-center gap-1.5 min-w-0">
                <!-- Status Dot -->
                <span
                  class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  :class="[
                    session.status === 'running'
                      ? 'bg-emerald-500 animate-pulse'
                      : session.status === 'completed'
                      ? 'bg-emerald-500'
                      : session.status === 'failed'
                      ? 'bg-destructive'
                      : 'bg-muted-foreground'
                  ]"
                />
                <span class="truncate text-[11px]" :title="session.modelName || session.modelId">
                  {{ session.modelName || session.modelId }}
                </span>
              </div>

              <!-- Speed TPS pill if exists -->
              <span
                v-if="session.metrics?.tpsWithTtft"
                class="font-mono text-[10px] text-muted-foreground flex-shrink-0"
              >
                {{ session.metrics.tpsWithTtft }} tps
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Standalone Sessions -->
      <div v-if="standaloneSessions.length > 0" class="space-y-1.5 pt-2">
        <div class="px-2 py-1 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
          独立会话 ({{ standaloneSessions.length }})
        </div>

        <div
          v-for="session in standaloneSessions"
          :key="session.id"
          class="px-2.5 py-2 rounded-xl border transition-all duration-150 cursor-pointer group/session flex items-center justify-between gap-2"
          :class="[
            testingStore.activeSlotSession?.id === session.id
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border/50 bg-card/50 hover:bg-muted/50 text-foreground'
          ]"
          @click="testingStore.selectSession(session.id)"
          @contextmenu.prevent="openContextMenu($event, 'session', session)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span
                class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                :class="[
                  session.status === 'running'
                    ? 'bg-emerald-500 animate-pulse'
                    : session.status === 'completed'
                    ? 'bg-emerald-500'
                    : session.status === 'failed'
                    ? 'bg-destructive'
                    : 'bg-muted-foreground'
                ]"
              />
              <span class="text-xs font-semibold truncate" :title="session.modelName || session.modelId">
                {{ session.modelName || session.modelId }}
              </span>
            </div>

            <div class="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
              <span>{{ session.providerName || session.providerId }}</span>
              <span>·</span>
              <span>{{ formatTimeAgo(session.createdAt) }}</span>
            </div>
          </div>

          <!-- Right: TPS or Delete -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <span
              v-if="session.metrics?.tpsWithTtft"
              class="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60"
            >
              {{ session.metrics.tpsWithTtft }} tps
            </span>

            <button
              type="button"
              class="opacity-0 group-hover/session:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
              title="删除会话"
              @click.stop="testingStore.deleteSession(session.id)"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right-Click Context Menu (Teleport to body to avoid overflow clipping) -->
    <Teleport to="body">
      <div v-if="contextMenu.visible">
        <!-- Transparent backdrop to dismiss menu on click or outside right-click -->
        <div
          class="fixed inset-0 z-[9998] cursor-default"
          @click="closeContextMenu"
          @contextmenu.prevent="closeContextMenu"
        />

        <!-- Floating Context Menu Panel -->
        <div
          class="fixed z-[9999] min-w-[210px] p-1.5 rounded-2xl border border-border/70 bg-card/95 dark:bg-card/95 backdrop-blur-2xl shadow-2xl text-xs space-y-0.5 select-none animate-in fade-in zoom-in-95 duration-100 text-foreground"
          :style="{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }"
        >
          <!-- Target Header -->
          <div class="px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground border-b border-border/40 flex items-center justify-between gap-2 mb-1">
            <span class="truncate max-w-[140px] font-semibold text-foreground" :title="contextMenu.targetTitle">
              {{ contextMenu.targetTitle }}
            </span>
            <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground flex-shrink-0">
              {{ contextMenu.type === 'session' ? '会话' : '测试组' }}
            </span>
          </div>

          <!-- Session Menu Options -->
          <template v-if="contextMenu.type === 'session' && contextMenu.session">
            <button
              type="button"
              class="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-muted text-foreground flex items-center gap-2 transition-colors group/item"
              @click="handleSlotIntoFocused"
            >
              <svg class="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>置入聚焦卡片 (#{{ testingStore.focusedSlotIndex + 1 }})</span>
            </button>

            <button
              type="button"
              class="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-muted text-foreground flex items-center gap-2 transition-colors group/item"
              @click="handleOpenInSingleMode"
            >
              <svg class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
              </svg>
              <span>在单卡视图打开</span>
            </button>

            <button
              type="button"
              class="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-muted text-foreground flex items-center gap-2 transition-colors group/item"
              @click="handleOpenFocusedModal"
            >
              <svg class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>全屏放大查看</span>
            </button>

            <button
              type="button"
              class="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-muted text-foreground flex items-center gap-2 transition-colors group/item"
              @click="handleOpenMetrics"
            >
              <svg class="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>查看双轨 TPS 指标</span>
            </button>

            <div class="h-px bg-border/40 my-1" />

            <button
              type="button"
              class="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-destructive/10 text-destructive flex items-center gap-2 transition-colors group/item"
              @click="handleDeleteSession"
            >
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>彻底删除记录 (SQLite)</span>
            </button>
          </template>

          <!-- Group Menu Options -->
          <template v-else-if="contextMenu.type === 'group' && contextMenu.group">
            <button
              type="button"
              class="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-muted text-foreground flex items-center gap-2 transition-colors group/item"
              @click="handleSelectGroup"
            >
              <svg class="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span>载入测试组到工作台</span>
            </button>

            <div class="h-px bg-border/40 my-1" />

            <button
              type="button"
              class="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-destructive/10 text-destructive flex items-center gap-2 transition-colors group/item"
              @click="handleDeleteGroup"
            >
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>彻底删除测试组 (SQLite)</span>
            </button>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useTestingStore } from "../../../stores/testing.js";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import type { TestSession, TestGroup } from "../../../types/testing.js";

const testingStore = useTestingStore();
const drawerStore = useDrawerStore();

const isFilterOpen = ref(false);
const expandedGroupIds = ref<Set<string>>(new Set());

// Context Menu State
const contextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  type: "session" | "group";
  session: TestSession | null;
  group: TestGroup | null;
  targetTitle: string;
}>({
  visible: false,
  x: 0,
  y: 0,
  type: "session",
  session: null,
  group: null,
  targetTitle: "",
});

function openContextMenu(event: MouseEvent, type: "session" | "group", item: TestSession | TestGroup) {
  const menuWidth = 220;
  const menuHeight = type === "session" ? 230 : 130;
  let x = event.clientX;
  let y = event.clientY;

  if (x + menuWidth > window.innerWidth) {
    x = Math.max(10, window.innerWidth - menuWidth - 10);
  }
  if (y + menuHeight > window.innerHeight) {
    y = Math.max(10, window.innerHeight - menuHeight - 10);
  }

  contextMenu.value = {
    visible: true,
    x,
    y,
    type,
    session: type === "session" ? (item as TestSession) : null,
    group: type === "group" ? (item as TestGroup) : null,
    targetTitle:
      type === "session"
        ? (item as TestSession).modelName || (item as TestSession).modelId
        : (item as TestGroup).name,
  };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
}

function handleSlotIntoFocused() {
  if (!contextMenu.value.session) return;
  testingStore.slotSession(testingStore.focusedSlotIndex, contextMenu.value.session.id);
  closeContextMenu();
}

function handleOpenInSingleMode() {
  if (!contextMenu.value.session) return;
  testingStore.layoutMode = "single";
  testingStore.selectSession(contextMenu.value.session.id);
  closeContextMenu();
}

function handleOpenFocusedModal() {
  if (!contextMenu.value.session) return;
  drawerStore.openFocusedModal(contextMenu.value.session.id);
  closeContextMenu();
}

function handleOpenMetrics() {
  if (!contextMenu.value.session) return;
  drawerStore.openTestMetrics(contextMenu.value.session.id);
  closeContextMenu();
}

async function handleDeleteSession() {
  if (!contextMenu.value.session) return;
  const sId = contextMenu.value.session.id;
  closeContextMenu();
  await testingStore.deleteSession(sId);
}

function handleSelectGroup() {
  if (!contextMenu.value.group) return;
  testingStore.selectGroup(contextMenu.value.group.id);
  closeContextMenu();
}

async function handleDeleteGroup() {
  if (!contextMenu.value.group) return;
  const gId = contextMenu.value.group.id;
  closeContextMenu();
  await testingStore.deleteGroup(gId);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && contextMenu.value.visible) {
    closeContextMenu();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
});

const isFilterActive = computed(() => {
  const f = testingStore.historyFilter;
  return (
    (f.taskId && f.taskId !== "all") ||
    (f.status && f.status !== "all") ||
    (f.dateRange && f.dateRange !== "all") ||
    !!f.searchQuery
  );
});

const totalSessionsCount = computed(() => Object.keys(testingStore.sessions).length);

const standaloneSessions = computed<TestSession[]>(() => {
  return testingStore.filteredHistorySessions.filter((s) => !s.groupId);
});

function getGroupSessions(groupId: string): TestSession[] {
  return Object.values(testingStore.sessions)
    .filter((s) => s.groupId === groupId)
    .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
}

function toggleGroupExpand(groupId: string) {
  if (expandedGroupIds.value.has(groupId)) {
    expandedGroupIds.value.delete(groupId);
  } else {
    expandedGroupIds.value.add(groupId);
  }
}

function resetFilter() {
  testingStore.historyFilter = {
    taskId: "all",
    status: "all",
    dateRange: "all",
    searchQuery: "",
  };
}

function formatLayoutName(mode: string): string {
  switch (mode) {
    case "single": return "单卡片";
    case "dual": return "双卡片横排";
    case "quad": return "四宫格";
    case "multi-col": return "多列横向";
    case "two-row-multi-col": return "两行多列";
    default: return mode || "单卡片";
  }
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return "";
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "刚刚";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  return `${Math.floor(diffSec / 86400)} 天前`;
}
</script>
