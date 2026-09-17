import { defineStore } from "pinia";

/**
 * 提供商列表批量操作（多选 / 全选 / 批量启用禁用）的交互状态。
 * 仅收敛批量模式本身的选择态与执行态，业务数据仍由 provider store 负责。
 */
export const useProviderSelectionStore = defineStore("provider-selection", {
  state: () => ({
    isBatchMode: false as boolean,
    selectedIds: [] as string[],
    isApplying: false as boolean,
  }),

  getters: {
    selectedCount: (state): number => state.selectedIds.length,
    isSelected: (state) => (id: string): boolean => state.selectedIds.includes(id),
    hasSelection(): boolean {
      return this.selectedIds.length > 0;
    },
  },

  actions: {
    enterBatchMode() {
      this.isBatchMode = true;
      this.selectedIds = [];
      this.isApplying = false;
    },

    exitBatchMode() {
      this.isBatchMode = false;
      this.selectedIds = [];
      this.isApplying = false;
    },

    toggleSelection(id: string) {
      if (this.isApplying) return;
      if (this.selectedIds.includes(id)) {
        this.selectedIds = this.selectedIds.filter((item) => item !== id);
      } else {
        this.selectedIds = [...this.selectedIds, id];
      }
    },

    /** 全选给定的可见提供商（严格遵循当前搜索过滤范围） */
    selectAll(ids: string[]) {
      if (this.isApplying) return;
      this.selectedIds = Array.from(new Set(ids.filter(Boolean)));
    },

    clearSelection() {
      if (this.isApplying) return;
      this.selectedIds = [];
    },
  },
});
