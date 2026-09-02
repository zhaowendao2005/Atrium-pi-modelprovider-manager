<template>
  <div class="flex h-screen w-screen bg-background text-foreground overflow-hidden">
    <!-- Collapsible Sidebar -->
    <Sidebar />

    <!-- Main Content Area (Independent scroll & follow parent height) -->
    <main class="flex-1 h-full overflow-hidden flex flex-col bg-background/50">
      <ProvidersView v-if="navStore.activeTab === 'providers'" />
      <SettingsView v-else-if="navStore.activeTab === 'settings'" />
    </main>

    <!-- Global Drawers (Provider Drawer & Model Drawer) -->
    <ProviderDrawer />
    <ModelDrawer />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import Sidebar from "./Sidebar.vue";
import ProvidersView from "../providers/ProvidersView.vue";
import SettingsView from "../settings/SettingsView.vue";
import ProviderDrawer from "../providers/components/ProviderDrawer.vue";
import ModelDrawer from "../providers/components/ModelDrawer.vue";
import { useNavigationStore } from "../../stores/windows/navigation.js";
import { useProviderStore } from "../../stores/provider.js";
import { useSettingsStore } from "../../stores/settings.js";

const navStore = useNavigationStore();
const providerStore = useProviderStore();
const settingsStore = useSettingsStore();

onMounted(() => {
  providerStore.init();
  settingsStore.init();
});
</script>
