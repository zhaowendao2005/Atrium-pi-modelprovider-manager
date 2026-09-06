<template>
  <MainLayout />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import MainLayout from "./views/layout/MainLayout.vue";
import { checkFamilyMapUpdate } from "./utils/model-family-registry.js";

onMounted(() => {
  // 注册全局键盘监听：F12 或 Ctrl+Shift+I 调出/关闭 DevTools
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i"))) {
      invoke("toggle_devtools").catch((err) => {
        console.warn("[DevTools] Failed to toggle devtools:", err);
      });
    }
  });

  // 延迟 8 秒在后台静默发起一次快速 HEAD 检查 (受 24 小时冷却控制)
  setTimeout(() => {
    checkFamilyMapUpdate(false).catch((err) => {
      console.debug("[App] Background silent family registry check skipped:", err);
    });
  }, 8000);
});
</script>
