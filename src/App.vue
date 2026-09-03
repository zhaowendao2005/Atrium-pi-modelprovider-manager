<template>
  <MainLayout />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import MainLayout from "./views/layout/MainLayout.vue";
import { checkFamilyMapUpdate } from "./utils/model-family-registry.js";

onMounted(() => {
  // 延迟 8 秒在后台静默发起一次快速 HEAD 检查 (受 24 小时冷却控制)
  setTimeout(() => {
    checkFamilyMapUpdate(false).catch((err) => {
      console.debug("[App] Background silent family registry check skipped:", err);
    });
  }, 8000);
});
</script>
