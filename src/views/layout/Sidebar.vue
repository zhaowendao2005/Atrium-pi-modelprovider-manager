<template>
  <aside
    class="relative h-full flex flex-col justify-between border-r border-border bg-card/80 backdrop-blur-xl transition-all duration-300 ease-in-out select-none z-20"
    :class="[navStore.isSidebarCollapsed ? 'w-16' : 'w-60']"
  >
    <!-- Top Section -->
    <div class="flex flex-col gap-4 p-3">
      <!-- App Header / Logo & Collapse Toggle -->
      <div class="flex items-center justify-between px-1 h-9">
        <div v-if="!navStore.isSidebarCollapsed" class="flex items-center gap-2.5 overflow-hidden">
          <!-- Pi Gateway Brand Logo with Beige Background -->
          <div class="w-7 h-7 rounded-xl bg-[#EDEAE3] border border-black/10 flex items-center justify-center text-[#111111] shadow-sm shadow-black/5 flex-shrink-0 p-1">
            <BrandLogo class="w-full h-full text-[#111111]" />
          </div>
          <span class="font-semibold text-sm tracking-tight text-foreground whitespace-nowrap">
            Pi Model Hub
          </span>
        </div>

        <div v-else class="w-full flex justify-center">
          <div class="w-7 h-7 rounded-xl bg-[#EDEAE3] border border-black/10 flex items-center justify-center text-[#111111] shadow-sm shadow-black/5 flex-shrink-0 p-1">
            <BrandLogo class="w-full h-full text-[#111111]" />
          </div>
        </div>

        <!-- Collapse/Expand Toggle Button (SVG) -->
        <button
          v-if="!navStore.isSidebarCollapsed"
          type="button"
          title="折叠侧边栏"
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          @click="navStore.toggleSidebar"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <!-- Expand Button when collapsed -->
      <button
        v-if="navStore.isSidebarCollapsed"
        type="button"
        title="展开侧边栏"
        class="w-full py-1.5 flex justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors"
        @click="navStore.toggleSidebar"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>

      <!-- Navigation Menu List -->
      <nav class="flex flex-col gap-1.5 mt-2">
        <!-- 1. Providers & Models Tab -->
        <button
          type="button"
          :title="navStore.isSidebarCollapsed ? '提供商与模型管理' : undefined"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150"
          :class="[
            navStore.activeTab === 'providers'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/70',
            navStore.isSidebarCollapsed ? 'justify-center px-0' : '',
          ]"
          @click="navStore.setActiveTab('providers')"
        >
          <!-- Layers / Server SVG Icon -->
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span v-if="!navStore.isSidebarCollapsed" class="whitespace-nowrap flex-1 text-left">
            模型提供商
          </span>
          <span
            v-if="!navStore.isSidebarCollapsed"
            class="text-[11px] px-1.5 py-0.5 rounded-md font-semibold"
            :class="[
              navStore.activeTab === 'providers'
                ? 'bg-white/20 text-white'
                : 'bg-muted text-muted-foreground',
            ]"
          >
            {{ providerStore.providers.length }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Bottom Section (Settings & Footer) - Always Bottom Aligned -->
    <div class="flex flex-col gap-2 p-3 border-t border-border/60">
      <button
        type="button"
        :title="navStore.isSidebarCollapsed ? '系统设置' : undefined"
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150"
        :class="[
          navStore.activeTab === 'settings'
            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/70',
          navStore.isSidebarCollapsed ? 'justify-center px-0' : '',
        ]"
        @click="navStore.setActiveTab('settings')"
      >
        <!-- Settings Gear SVG Icon -->
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span v-if="!navStore.isSidebarCollapsed" class="whitespace-nowrap">
          配置与设置
        </span>
      </button>

      <div v-if="!navStore.isSidebarCollapsed" class="px-2 pt-1 text-[11px] text-muted-foreground/60 flex items-center justify-between">
        <span>Pi Extension v1.0</span>
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import BrandLogo from "../../components/ui/BrandLogo.vue";
import { useNavigationStore } from "../../stores/windows/navigation.js";
import { useProviderStore } from "../../stores/provider.js";

const navStore = useNavigationStore();
const providerStore = useProviderStore();
</script>
