<template>
  <Sheet
    :model-value="drawerStore.isTestTaskMaterialsOpen"
    :title="testingStore.activeTask?.name || '任务资料'"
    :description="sheetDescription"
    max-width-class="max-w-2xl"
    @update:model-value="onOpenChange"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-1 p-1 rounded-xl bg-muted/60">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          :class="drawerStore.testTaskMaterialTab === tab.id
            ? 'bg-card text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'"
          @click="drawerStore.setTestTaskMaterialTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="drawerStore.testTaskMaterialTab === 'plan'" class="flex flex-col gap-2">
        <p class="text-xs text-muted-foreground">沙箱启动后会写入 `plan.md`，Agent 按该计划执行。</p>
        <pre
          v-if="testingStore.activeTask?.plan"
          class="whitespace-pre-wrap text-xs leading-relaxed font-mono text-foreground bg-muted/40 border border-border/60 rounded-2xl p-4"
        >{{ testingStore.activeTask.plan }}</pre>
        <p v-else class="text-xs text-muted-foreground">当前任务没有独立计划文档，将直接执行用户指令。</p>
      </div>

      <div v-else-if="drawerStore.testTaskMaterialTab === 'docs'" class="flex flex-col gap-3">
        <p class="text-xs text-muted-foreground">这些资料会复制到沙箱 `docs/` 目录，测试运行时不访问外网。</p>
        <div v-if="docs.length === 0" class="text-xs text-muted-foreground">当前任务没有附加资料文档。</div>
        <div v-else class="flex flex-col gap-2">
          <button
            v-for="doc in docs"
            :key="doc.filename"
            type="button"
            class="text-left px-3 py-2 rounded-xl border transition-colors"
            :class="drawerStore.activeTestTaskDocName === doc.filename
              ? 'border-primary/30 bg-primary/10 text-foreground'
              : 'border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground'"
            @click="drawerStore.openTestTaskDoc(doc.filename)"
          >
            <div class="text-xs font-semibold truncate">{{ doc.filename }}</div>
            <div class="text-[11px] opacity-70">{{ doc.content.length }} 字符</div>
          </button>
          <pre
            v-if="activeDoc"
            class="whitespace-pre-wrap text-xs leading-relaxed font-mono text-foreground bg-muted/40 border border-border/60 rounded-2xl p-4"
          >{{ activeDoc.content }}</pre>
        </div>
      </div>

      <div v-else class="flex flex-col gap-2">
        <p class="text-xs text-muted-foreground">任务完成后应出现在沙箱工作目录中的期望产出。</p>
        <ul v-if="outputs.length > 0" class="flex flex-col gap-1.5">
          <li
            v-for="item in outputs"
            :key="item"
            class="px-3 py-2 rounded-xl bg-muted/40 border border-border/60 text-xs font-mono text-foreground"
          >
            {{ item }}
          </li>
        </ul>
        <p v-else class="text-xs text-muted-foreground">当前任务没有声明期望产出文件。</p>
      </div>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Sheet from "../../../components/ui/Sheet.vue";
import { useDrawerStore } from "../../../stores/windows/drawer.js";
import { useTestingStore } from "../../../stores/testing.js";

const drawerStore = useDrawerStore();
const testingStore = useTestingStore();

const tabs = [
  { id: "plan" as const, label: "计划文档" },
  { id: "docs" as const, label: "参考资料" },
  { id: "outputs" as const, label: "期望产出" },
];

const docs = computed(() => testingStore.activeTask?.docs || []);
const outputs = computed(() => testingStore.activeTask?.expectedOutputs || []);
const activeDoc = computed(() => {
  const name = drawerStore.activeTestTaskDocName;
  if (!name) return docs.value[0] || null;
  return docs.value.find((item) => item.filename === name) || docs.value[0] || null;
});

const sheetDescription = computed(() => {
  const task = testingStore.activeTask;
  if (!task) return "查看当前任务模板资料";
  return task.description;
});

function onOpenChange(value: boolean) {
  if (value) {
    drawerStore.openTestTaskMaterials(drawerStore.testTaskMaterialTab);
  } else {
    drawerStore.closeTestTaskMaterials();
  }
}
</script>
