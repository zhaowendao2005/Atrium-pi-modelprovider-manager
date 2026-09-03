<template>
  <div class="flex flex-col gap-2 w-full">
    <!-- Header row or empty state -->
    <div v-if="rows.length === 0" class="py-3 px-3 text-center text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/40 border border-dashed border-border/80 rounded-xl">
      {{ props.emptyText || "暂未配置键值对" }}
    </div>

    <!-- Rows -->
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="(row, idx) in rows"
        :key="row.id"
        class="flex items-center gap-2"
      >
        <!-- Key input -->
        <div class="flex-1">
          <input
            v-model="row.key"
            type="text"
            :placeholder="props.keyPlaceholder || 'Key'"
            class="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            @input="onRowChange"
          />
        </div>

        <!-- Value input -->
        <div class="flex-1">
          <input
            v-model="row.value"
            type="text"
            :placeholder="props.valuePlaceholder || 'Value'"
            class="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            @input="onRowChange"
          />
        </div>

        <!-- Remove row button -->
        <button
          type="button"
          title="移除此项"
          class="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
          @click="removeRow(idx)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Add button -->
    <div>
      <button
        type="button"
        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 border border-primary/20 transition-colors"
        @click="addRow"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
        </svg>
        <span>{{ props.addButtonText || "添加项" }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

interface Props {
  modelValue?: Record<string, string>;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addButtonText?: string;
  emptyText?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", val: Record<string, string>): void;
}>();

interface RowItem {
  id: string;
  key: string;
  value: string;
}

let rowCounter = 0;
const rows = ref<RowItem[]>([]);

function syncFromProps() {
  const current = props.modelValue || {};
  const newRows: RowItem[] = [];
  for (const [k, v] of Object.entries(current)) {
    newRows.push({
      id: `row_${++rowCounter}`,
      key: k,
      value: String(v ?? ""),
    });
  }
  rows.value = newRows;
}

watch(
  () => props.modelValue,
  () => {
    const curObj: Record<string, string> = {};
    for (const r of rows.value) {
      if (r.key.trim()) {
        curObj[r.key.trim()] = r.value;
      }
    }
    const propObj = props.modelValue || {};
    if (JSON.stringify(curObj) !== JSON.stringify(propObj)) {
      syncFromProps();
    }
  },
  { immediate: true, deep: true }
);

function addRow() {
  rows.value.push({
    id: `row_${++rowCounter}`,
    key: "",
    value: "",
  });
}

function removeRow(idx: number) {
  rows.value.splice(idx, 1);
  emitUpdate();
}

function onRowChange() {
  emitUpdate();
}

function emitUpdate() {
  const result: Record<string, string> = {};
  for (const r of rows.value) {
    if (r.key.trim()) {
      result[r.key.trim()] = r.value;
    }
  }
  emit("update:modelValue", result);
}
</script>
