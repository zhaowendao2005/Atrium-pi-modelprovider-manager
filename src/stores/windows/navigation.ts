import { defineStore } from "pinia";

export const useNavigationStore = defineStore("navigation", {
  state: () => ({
    isSidebarCollapsed: false as boolean,
    activeTab: "providers" as "providers" | "testing" | "settings",
  }),

  actions: {
    toggleSidebar() {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    },
    setSidebarCollapsed(collapsed: boolean) {
      this.isSidebarCollapsed = collapsed;
    },
    setActiveTab(tab: "providers" | "testing" | "settings") {
      this.activeTab = tab;
    },
  },
});
