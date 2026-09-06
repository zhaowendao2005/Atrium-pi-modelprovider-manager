# Vue TUI 文件树扫描器开发计划

## 项目概述

使用 vue-tui 库构建一个终端文件树扫描工具，支持快速扫描指定路径、预览文件和导出结果。

## 技术栈

- **框架**: Vue 3 + TypeScript
- **TUI 库**: vue-tui (@vue-tui/runtime, @vue-tui/use, @vue-tui/components, @vue-tui/vite)
- **包管理器**: pnpm
- **运行环境**: Node.js 22+

## 核心功能

1. **置顶路径管理**：添加/删除/编辑置顶扫描路径
2. **文件树扫描**：快速扫描目录树，支持忽略规则（node_modules、.git 等）
3. **文件预览**：文本文件语法高亮、二进制文件信息、目录统计
4. **导出功能**：导出为 JSON、Markdown、文本格式
5. **快捷键导航**：上下箭头、回车、空格、Ctrl+P 置顶

## 目录结构

```
vue-tui-scanner/
├── package.json
├── vite.config.ts
├── src/
│   ├── main.ts
│   ├── app.vue
│   ├── stores/
│   │   └── scanner.ts
│   ├── components/
│   │   ├── FileTree.vue
│   │   ├── FilePreview.vue
│   │   ├── PathManager.vue
│   │   └── ExportDialog.vue
│   └── utils/
│       ├── scanner.ts
│       ├── exporter.ts
│       └── file-types.ts
└── tsconfig.json
```

## 实现步骤

### 步骤 1：项目初始化
- 使用 pnpm 创建项目
- 安装依赖：vue, @vue-tui/runtime, @vue-tui/use, @vue-tui/components, @vue-tui/vite, unplugin-vue, vite, vue-tsc, typescript, @types/node
- 配置 vite.config.ts 使用 @vue-tui/vite 插件

### 步骤 2：核心入口
- main.ts：使用 createApp(App).mount({ exitOnCtrlC: true })
- app.vue：主布局，左侧文件树，右侧预览

### 步骤 3：文件树组件
- FileTree.vue：递归渲染目录树
- 支持展开/折叠目录
- 支持键盘导航（上下箭头选择，回车展开/预览）

### 步骤 4：文件预览组件
- FilePreview.vue：根据文件类型显示预览
- 文本文件：显示前 50 行
- 二进制文件：显示大小、类型信息
- 目录：显示子文件数量和总大小

### 步骤 5：路径管理
- PathManager.vue：管理置顶路径列表
- 支持添加、删除、编辑路径
- 路径优先级排序

### 步骤 6：导出功能
- ExportDialog.vue：选择导出格式
- 导出为 JSON（完整树结构）
- 导出为 Markdown（树形文本）
- 导出为文本（简单列表）

### 步骤 7：状态管理
- scanner.ts store：管理扫描状态、当前选中文件、路径列表
- 使用 Pinia 或 Vue reactive

## 关键技术点

1. **vue-tui 组件使用**：
   - `<Box>`：布局容器，支持 flex、size、spacing、border
   - `<Text>`：文本显示，支持颜色、修饰符、换行
   - `<ScrollBox>`：滚动视口，通过 imperative handle 控制
   - `<Table>`：表格显示，支持列定义和格式化

2. **vue-tui 组合式 API**：
   - `useInput(handler, opts?)`：处理键盘输入
   - `useFocus(target?)`：焦点管理
   - `useApp()`：应用生命周期（exit）
   - `useLayoutSize()`：获取根布局尺寸
   - `useBoxMetrics(ref)`：获取 Box 尺寸

3. **输入事件处理**：
   - event.type === "key"：按键事件（箭头、回车、空格）
   - event.type === "text"：文本输入
   - event.type === "paste"：粘贴事件

4. **应用生命周期**：
   - createApp(App).mount({ exitOnCtrlC: true })：启动应用
   - useApp().exit()：退出应用

## 依赖版本

```json
{
  "dependencies": {
    "@vue-tui/runtime": "latest",
    "@vue-tui/use": "latest",
    "@vue-tui/components": "latest",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@vue-tui/vite": "latest",
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^6.0.0",
    "vue-tsc": "^2.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0",
    "unplugin-vue": "latest"
  }
}
```

## 构建与运行

```bash
# 开发
pnpm dev

# 构建
pnpm build

# 预览
pnpm preview
```

## 注意事项

1. vue-tui 目前处于 Public Beta 阶段，API 可能变化
2. 构建可执行文件需要 Node.js 26+
3. Windows 下可执行文件为 build/main.exe
4. 所有操作必须在沙箱目录内完成，不能访问外部网络
