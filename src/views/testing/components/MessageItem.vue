<template>
  <div class="w-full py-2.5 transition-colors">
    <!-- 1. System Role Message -->
    <div
      v-if="message.role === 'system'"
      class="max-w-2xl mx-auto px-4 py-2 rounded-xl bg-muted/40 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2"
    >
      <svg class="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="font-semibold text-foreground/80 flex-shrink-0">System:</span>
      <span class="truncate font-mono">{{ message.content }}</span>
    </div>

    <!-- 2. User Role Message -->
    <div
      v-else-if="message.role === 'user'"
      class="flex justify-end pl-6"
    >
      <div class="max-w-[88%] bg-primary text-primary-foreground px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm shadow-primary/10 break-words">
        <div class="text-xs font-sans leading-relaxed whitespace-pre-wrap select-text break-words">
          {{ message.content }}
        </div>
        <div class="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-primary-foreground/70">
          <span>{{ formatTime(message.createdAt) }}</span>
        </div>
      </div>
    </div>

    <!-- 3. Assistant Role Message (Streaming / Reasoning / Tools / Text) -->
    <div
      v-else-if="message.role === 'assistant' && hasAssistantContent"
      class="flex gap-2.5 w-full min-w-0"
    >
      <!-- Assistant Avatar / Badge -->
      <div class="w-7 h-7 rounded-xl bg-card border border-border/80 shadow-xs flex items-center justify-center flex-shrink-0 text-primary mt-0.5 overflow-hidden">
        <ModelLogo
          v-if="testingStore.selectedModelId"
          :model="{ id: testingStore.selectedModelId }"
          :size="26"
        />
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      <!-- Assistant Body: 按照真实发起的时间线时序单向推进 -->
      <div class="flex-1 min-w-0 flex flex-col gap-2">
        <!-- 3.1 现代 Agent 时间线流式渲染 (Timeline Stream) -->
        <template v-if="message.parts && message.parts.length > 0">
          <template v-for="part in message.parts" :key="part.id">
            <!-- (1) 深度思考块 (按时间线出现) -->
            <ReasoningBlock
              v-if="part.type === 'reasoning'"
              :reasoning="part"
            />

            <!-- (2) 工具调用卡片 (按时间线出现，闭合即渲染，默认折叠) -->
            <ToolInvocationItem
              v-else-if="part.type === 'tool'"
              :tool="part"
            />

            <!-- (3) 正文文本段落 (按时间线出现，真正有内容流出时才展示卡片) -->
            <div
              v-else-if="part.type === 'text' && part.content && part.content.length > 0"
              class="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-3.5 text-xs text-foreground leading-relaxed select-text shadow-xs break-words overflow-hidden"
            >
              <div class="flex flex-col gap-2.5">
                <template v-for="(block, idx) in parseBlocks(part.content)" :key="idx">
                  <!-- Code block -->
                  <div v-if="block.type === 'code'" class="my-1 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                    <div class="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{{ block.lang || 'code' }}</span>
                      <button
                        type="button"
                        class="hover:text-slate-200 transition-colors flex items-center gap-1"
                        @click="copyCode(block.text, `${part.id}-${idx}`)"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {{ copiedKey === `${part.id}-${idx}` ? '已复制' : '复制' }}
                      </button>
                    </div>
                    <pre class="p-3 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed apple-scrollbar select-text">{{ block.text }}</pre>
                  </div>

                  <!-- Normal text paragraph -->
                  <div
                    v-else
                    class="whitespace-pre-wrap leading-relaxed break-words overflow-hidden"
                    v-html="renderInlineMarkdown(block.text)"
                  />
                </template>
              </div>

              <!-- Pulsing streaming cursor -->
              <span
                v-if="part.isStreaming"
                class="inline-block w-2 h-4 ml-0.5 bg-primary rounded-xs animate-pulse align-middle"
              />
            </div>
          </template>
        </template>

        <!-- 3.2 兼容历史结构兜底 -->
        <template v-else>
          <ReasoningBlock
            v-if="message.reasoning"
            :reasoning="message.reasoning"
          />
          <div v-if="message.toolInvocations && message.toolInvocations.length > 0" class="flex flex-col">
            <ToolInvocationItem
              v-for="tool in message.toolInvocations"
              :key="tool.toolCallId"
              :tool="tool"
            />
          </div>
          <div
            v-if="message.content && message.content.length > 0"
            class="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-3.5 text-xs text-foreground leading-relaxed select-text shadow-xs break-words overflow-hidden"
          >
            <div class="flex flex-col gap-2.5">
              <template v-for="(block, idx) in parseBlocks(message.content)" :key="idx">
                <div v-if="block.type === 'code'" class="my-1 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <div class="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{{ block.lang || 'code' }}</span>
                    <button
                      type="button"
                      class="hover:text-slate-200 transition-colors flex items-center gap-1"
                      @click="copyCode(block.text, `legacy-${idx}`)"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {{ copiedKey === `legacy-${idx}` ? '已复制' : '复制' }}
                    </button>
                  </div>
                  <pre class="p-3 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed apple-scrollbar select-text">{{ block.text }}</pre>
                </div>
                <div
                  v-else
                  class="whitespace-pre-wrap leading-relaxed break-words overflow-hidden"
                  v-html="renderInlineMarkdown(block.text)"
                />
              </template>
            </div>
          </div>
        </template>

        <!-- 3.3 底部状态与时间戳信息 -->
        <div v-if="message.isStreaming || message.createdAt" class="pt-1 flex items-center justify-between text-[10px] text-muted-foreground/60 px-1">
          <div>
            <span v-if="message.isStreaming" class="text-primary font-medium flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              正在生成...
            </span>
          </div>
          <span v-if="message.createdAt">{{ formatTime(message.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { UIMessage } from "../../../types/testing.js";
import { useTestingStore } from "../../../stores/testing.js";
import ModelLogo from "../../../components/ui/ModelLogo.vue";
import ReasoningBlock from "./ReasoningBlock.vue";
import ToolInvocationItem from "./ToolInvocationItem.vue";

const testingStore = useTestingStore();

const props = defineProps<{
  message: UIMessage;
}>();

const hasAssistantContent = computed(() => {
  if (props.message.parts && props.message.parts.length > 0) {
    return props.message.parts.some((p) => {
      if (p.type === "reasoning") return !!p.content?.trim();
      if (p.type === "tool") return true;
      if (p.type === "text") return !!p.content?.trim();
      return false;
    });
  }
  return (
    !!props.message.content?.trim() ||
    !!props.message.reasoning?.content?.trim() ||
    (props.message.toolInvocations && props.message.toolInvocations.length > 0)
  );
});

const copiedKey = ref<string | null>(null);

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface Block {
  type: "text" | "code";
  text: string;
  lang?: string;
}

// 解析代码块与普通文本段落
function parseBlocks(content?: string): Block[] {
  if (!content) return [];

  const blocks: Block[] = [];
  const codeRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = content.substring(lastIndex, match.index);
      if (textChunk.trim().length > 0) {
        blocks.push({ type: "text", text: textChunk });
      }
    }
    blocks.push({
      type: "code",
      lang: match[1] || "text",
      text: match[2].trimEnd(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const trailing = content.substring(lastIndex);
    if (trailing.length > 0) {
      blocks.push({ type: "text", text: trailing });
    }
  }

  return blocks;
}

// 轻量内联 Markdown 转换（转义 HTML、内联代码、加粗、标题）
function renderInlineMarkdown(rawText: string): string {
  let safe = rawText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  safe = safe.replace(/^### (.*$)/gim, '<h3 class="text-xs font-bold text-foreground mt-2 mb-1">$1</h3>');
  safe = safe.replace(/^## (.*$)/gim, '<h2 class="text-sm font-bold text-foreground mt-2 mb-1">$1</h2>');
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  safe = safe.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-primary break-all inline align-baseline">$1</code>');

  return safe;
}

async function copyCode(code: string, key: string) {
  try {
    await navigator.clipboard.writeText(code);
    copiedKey.value = key;
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null;
    }, 1500);
  } catch (err) {
    console.error("复制失败", err);
  }
}
</script>
