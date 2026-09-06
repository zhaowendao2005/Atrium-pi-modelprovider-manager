<template>
  <div class="flex h-screen w-screen bg-background text-foreground overflow-hidden">
    <!-- Collapsible Sidebar -->
    <Sidebar />

    <!-- Main Content Area (Independent scroll & follow parent height) -->
    <main class="flex-1 h-full overflow-hidden flex flex-col bg-background/50">
      <ProvidersView v-if="navStore.activeTab === 'providers'" />
      <TestingView v-else-if="navStore.activeTab === 'testing'" />
      <SettingsView v-else-if="navStore.activeTab === 'settings'" />
    </main>

    <!-- Global Drawers (Provider Drawer & Model Drawer & Docs Drawer) -->
    <ProviderDrawer />
    <ModelDrawer />
    <DocsDrawer />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import Sidebar from "./Sidebar.vue";
import ProvidersView from "../providers/ProvidersView.vue";
import TestingView from "../testing/TestingView.vue";
import SettingsView from "../settings/SettingsView.vue";
import ProviderDrawer from "../providers/components/ProviderDrawer.vue";
import ModelDrawer from "../providers/components/ModelDrawer.vue";
import { DocsDrawer } from "../providers/components/DocsDrawer/index.js";
import { useNavigationStore } from "../../stores/windows/navigation.js";
import { useProviderStore } from "../../stores/provider.js";
import { useSettingsStore } from "../../stores/settings.js";
import { usePresetsStore } from "../../stores/presets.js";
import { useTestingStore } from "../../stores/testing.js";

const navStore = useNavigationStore();
const providerStore = useProviderStore();
const settingsStore = useSettingsStore();
const presetsStore = usePresetsStore();
const testingStore = useTestingStore();

onMounted(async () => {
  try {
    await settingsStore.init();
    await providerStore.init();
    await presetsStore.loadIndex();
    await testingStore.loadTasks();
  } catch (err) {
    console.error("[MainLayout] SQLite initialization failed:", err);
  }
});
</script>
