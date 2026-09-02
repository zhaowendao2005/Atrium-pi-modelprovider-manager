<template>
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    :class="props.class"
  >
    <!-- 主网关控制核心 (带内挖槽) -->
    <path fill-rule="evenodd" clip-rule="evenodd" d="M2 2H16V10H10V16H2V2ZM6 6H12V8H8V12H6V6Z"/>
    <!-- 外部接入的独立厂商模块块 (OpenAI, Claude, 本地模型等) -->
    <path d="M18 2H22V6H18V2Z"/>
    <path d="M18 10H22V14H18V10Z"/>
    <path d="M10 18H14V22H10V18Z"/>
    <path d="M18 18H22V22H18V18Z"/>
  </svg>
</template>

<script setup lang="ts">
const props = defineProps<{
  class?: string;
}>();
</script>
