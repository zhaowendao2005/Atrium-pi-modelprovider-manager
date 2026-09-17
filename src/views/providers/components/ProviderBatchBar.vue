<template>
  <div class="border-t border-border/60 bg-card/60 backdrop-blur-md px-3 py-2 flex flex-col gap-2 flex-shrink-0 select-none">
    <!-- 选择概览：全选当前列表 + 已选计数 -->
    <div class="flex items-center justify-between gap-2">
      <button
        type="button"
        class="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        :disabled="props.busy || props.visibleCount === 0"
        @click="$emit('toggle-all')"
      >
        <span
          class="w-3.5 h-3.5 rounded-[5px] border flex items-center justify-center transition-colors"
          :class="[
            props.allSelected
              ? 'bg-primary border-primary text-primary-foreground'
              : props.selectedCount > 0
                ? 'bg-primary/15 border-primary/60 text-primary'
                : 'border-slate-300 dark:border-slate-600',
          ]"
        >
          <svg v-if="props.allSelected" class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else-if="props.selectedCount > 0" class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 12h14" />
          </svg>
        </span>
        <span>全选当前列表 ({{ props.visibleCount }})</span>
      </button>

      <span class="font-mono text-[11px] text-muted-foreground">
        已选 {{ props.selectedCount }}
      </span>
    </div>

    <!-- 批量操作按钮 -->
    <div class="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        class="h-7 flex-1 text-xs gap-1"
        :disabled="!props.selectedCount || props.busy"
        :loading="props.busy && props.pendingAction === 'enable'"
        @click="$emit('apply', true)"
      >
        <svg v-if="!(props.busy && props.pendingAction === 'enable')" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M12 3v9" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M7.5 6.5a7 7 0 109 0" />
        </svg>
        启用
      </Button>

      <Button
        size="sm"
        variant="outline"
        class="h-7 flex-1 text-xs gap-1"
        :disabled="!props.selectedCount || props.busy"
        :loading="props.busy && props.pendingAction === 'disable'"
        @click="$emit('apply', false)"
      >
        <svg v-if="!(props.busy && props.pendingAction === 'disable')" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M12 21v-9" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M7.5 17.5a7 7 0 119 0" />
        </svg>
        禁用
      </Button>

      <Button
        size="sm"
        variant="ghost"
        class="h-7 text-xs"
        :disabled="props.busy"
        @click="$emit('exit')"
      >
        完成
      </Button>
    </div>

    <!-- 操作反馈 -->
    <p
      v-if="props.message"
      class="text-[11px] leading-tight"
      :class="[
        props.message.type === 'error'
          ? 'text-destructive'
          : props.message.type === 'success'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-muted-foreground',
      ]"
    >
      {{ props.message.text }}
    </p>
  </div>
</template>

<script setup lang="ts">
import Button from "../../../components/ui/Button.vue";

const props = defineProps<{
  selectedCount: number;
  visibleCount: number;
  allSelected: boolean;
  busy: boolean;
  pendingAction: "enable" | "disable" | null;
  message: { type: "success" | "info" | "error"; text: string } | null;
}>();

defineEmits<{
  (e: "toggle-all"): void;
  (e: "apply", enabled: boolean): void;
  (e: "exit"): void;
}>();
</script>
