# Atrium - Pi Model Provider Manager

**Atrium (Atrium - Pi Model Provider Manager)** 是专为 **Pi (pi-coding-agent)** 打造的下一代现代化多模型、多中转站可视化管理与评测工作台。

它同时具备双重产品形态：
1. **Pi Agent 运行时扩展 (Extension)**：无缝挂载至 Pi Agent，提供底层请求钩子（Hooks）、多协议适配器（Adapters）、上下文溢出自动恢复、链路追踪以及终端快速切换器（TUI）；
2. **桌面原生可视化工作台 (Tauri + Vue 3 + Tailwind CSS + Pinia)**：采用 Apple 极简设计范式，提供全流程模型管理、动态模型探测（`/v1/models`）、以及多模型同台竞技的**测试工作台（Test Arena）**。

> 🌐 **在线文档站 (Docsify)**  
> 📖 访问高清交互式官方文档（支持全局检索与侧边栏目录）：[https://zhaowendao2005.github.io/Atrium-pi-modelprovider-manager/#/](https://zhaowendao2005.github.io/Atrium-pi-modelprovider-manager/#/)

---

## ✨ 核心特性

- **现代 Apple 美学界面**：折叠侧边栏、细腻平滑过渡、卡片化布局与自定义 Apple 滚动条。
- **本地优先（Local-First）与 SQLite 存储**：彻底弃用难以维护的冗长 YAML，所有配置、密钥与历史会话均持久化于本地 SQLite（`manager.db`），保障数据隐私与秒级加载。
- **多协议原生适配（9 种协议）**：深度兼容 OpenAI、Anthropic、Grok (xAI)、Ollama、Google Gemini、DeepSeek、Mistral、OpenRouter 等，支持 Thinking Level 智能映射与参数清洗。
- **海量内置预设与动态发现**：出厂自带 39+ 官方厂商规范与 1300+ 模型元数据，支持从中转站 `/v1/models` 端点一键自动拉取并分类挂载。
- **模型测试竞技场（Benchmark Arena）**：
  - 真实沙箱环境：每个测试卡片运行在完全隔离的工作空间；
  - 评测指标全景图：首字延迟（TTFT）、生成耗时、双轨 TPS 吞吐、工具调用（Tool Calls）成功率与网络时序拆解。
- **无感单实例桌面唤起**：在 Pi Agent 中输入 `/model-manager` 或直接运行桌面程序，支持单实例智能置顶聚焦，不重复弹出多余窗口。

---

## 📚 用户手册与文档导览

项目提供详尽的模块化使用手册与深入指南，无论是在本地 Markdown 浏览，还是通过 GitHub Pages 在线查阅均可快速定标：

| 章节 | 文档名 | 核心内容简介 |
| :--- | :--- | :--- |
| **00** | [项目概览与背景](docs/index.md) | 为什么开发 Atrium、解决的中转痛点与核心架构理念 |
| **01** | [快速上手指南](docs/01-quickstart.md) | 3 分钟完成安装、桌面窗口唤起与添加第一个模型渠道 |
| **02** | [提供商管理](docs/02-providers-management.md) | 中转站配置、端点鉴权、实时连通性测速与高级参数覆盖 |
| **03** | [模型配置与挂载](docs/03-models-configuration.md) | 模型系列分组、Thinking 思考等级映射与 `/v1/models` 动态一键拉取 |
| **04** | [生效配置体系](docs/04-effective-config-docs.md) | 参数继承与覆盖规则分析、三级生效溯源（Preset / Provider / Model） |
| **05** | [模型测试竞技场](docs/05-testing-workbench.md) | 多模型同台竞技、沙箱工作空间、双轨 TPS 吞吐、首字延迟（TTFT）与请求链路图 |
| **06** | [TUI 与运行时插件](docs/06-tui-and-extension.md) | Pi Agent 扩展运行时机制、`/models` 选择器与 `Alt+P` 快捷呼出 |
| **07** | [系统设置与持久化](docs/07-settings-and-maintenance.md) | SQLite 数据库结构、开发与生产环境隔离机制、数据备份与迁移 |
| **08** | [常见问题与排错手册](docs/08-troubleshooting.md) | 常见网络报错、适配器异常、多实例聚焦故障速查表 |

> 💡 **在线查阅**：你也可以直接访问官方文档站进行全站检索与深度阅读：[👉 Atrium 官方文档站 (GitHub Pages)](https://zhaowendao2005.github.io/Atrium-pi-modelprovider-manager/#/)。

---

## 🧭 架构与设计规范

- 📖 **前端设计规范与范式**：参见 [dev_docs/rules/前端设计规范和范式.md](file:///D:/code/javascript/pi-extension/pi-modelprovider-manager/dev_docs/rules/%E5%89%8D%E7%AB%AF%E8%AE%BE%E8%AE%A1%E8%A7%84%E8%8C%83%E5%92%8C%E8%8C%83%E5%BC%8F.md)。
- 📖 **底层协议与规范分析**：参见 [dev_docs/analysis_result/模型与提供商规范分析.md](file:///D:/code/javascript/pi-extension/pi-modelprovider-manager/dev_docs/analysis_result/%E6%A8%A1%E5%9E%8B%E4%B8%8E%E6%8F%90%E4%BE%9B%E5%95%86%E8%A7%84%E8%8C%83%E5%BC%8F%E5%88%86%E6%9E%90.md)。
- 📖 **快捷键支持**：Pi Agent 内键入 `/models` 或按下 `Alt+P` 即可呼出模型快速切换选择器。

---

## 📦 打包产物结构 (`dist/`)

运行 `pnpm build` 命令将一键构建并将 **独立插件包** 输出到 `dist/atrium-pi-modelprovider-manager/`：

```text
dist/atrium-pi-modelprovider-manager/
├── index.js                     # Pi Extension 插件入口代码
├── index.d.ts                   # TypeScript 类型声明定义
├── adapters/                    # 运行时多协议适配模块（如 grok-core 等）
│   ├── grok-core.js
│   └── grok-core.d.ts
├── bin/                         # Tauri 桌面端二进制程序（前端已静态内嵌）
│   └── atrium-pi-modelprovider-manager.exe
├── templates/                   # 内置基准评测任务集（供测试竞技场动态加载）
│   └── test_tasks/
│       ├── 01_site_availability/
│       ├── 02_deep_reasoning/
│       ├── 03_multi_tool_pipeline/
│       └── ...
├── README.md                    # 随包说明文档
└── package.json                 # 专为插件单元独立运行设计的元数据
```

---

## ⚙️ 常用构建与开发命令

| 命令 | 执行动作 | 说明 |
| :--- | :--- | :--- |
| **`pnpm build`** | `pnpm clean && pnpm build:ext && pnpm build:tauri && pnpm assemble:plugin` | **一键全量打包**：输出标准插件单元，包含 Extension、UI 内嵌可执行文件及模板 |
| **`pnpm publish:plugin`** | `npm publish ./dist/atrium-pi-modelprovider-manager --access public` | **一键发布**：将组装完毕的独立插件发布至 npm |
| **`pnpm dev`** | `node scripts/dev.mjs` | **联调开发**：同步最新模型预设，构建扩展，并启动本地 Tauri 桌面热重载 |
| **`pnpm dev:ui`** | `vite` | 仅启动纯 Web 前端开发服务器 (http://localhost:8632) |
| **`pnpm build:ext`** | `tsup` | 仅构建 Extension 扩展与适配器（输出至 `dist/`） |
| **`pnpm build:ui`** | `vue-tsc --noEmit && vite build` | 仅对前端进行类型检查并生成嵌入式静态资产 |
| **`pnpm build:tauri`** | `tauri build --no-bundle && copy-binary` | 仅编译桌面端 Rust 二进制程序 |
| **`pnpm typecheck`** | `tsc --noEmit` | 全局 TypeScript 类型检查 |

---

## 🚀 安装与使用方式

### 方式 1：通过 npm / Pi 插件命令安装（推荐）

本包已正式发布到 npm：[`atrium-pi-modelprovider-manager`](https://www.npmjs.com/package/atrium-pi-modelprovider-manager)

你可以直接通过 `pi install` 命令一键安装：
```bash
# 推荐：使用 Pi CLI 直接安装 npm 包
pi install atrium-pi-modelprovider-manager

# 或使用 npm / pnpm 全局/本地安装
npm install atrium-pi-modelprovider-manager
```

安装完成后，Pi Agent 将自动识别并启用本扩展。

### 方式 2：使用本地构建产物直接加载
```bash
pi -e ./dist/atrium-pi-modelprovider-manager/index.js
```

### 方式 3：全局放入 Pi 扩展自动加载目录（支持 `/reload`）
- **全局路径**：`~/.pi/agent/extensions/atrium-pi-modelprovider-manager/`
- **项目级路径**：`.pi/extensions/atrium-pi-modelprovider-manager/`

### 方式 4：打开桌面可视化管理器
- **在 Pi Agent 内部**：键入命令 `/model-manager`
- **独立运行**：直接双击运行 `./dist/atrium-pi-modelprovider-manager/bin/atrium-pi-modelprovider-manager.exe`

---

## 🛡️ 环境与持久化隔离

- **生产环境**：默认读写 `~/.pi/atrium-pi-modelprovider-manager-data/`（自动兼容历史 `pi-modelprovider-manager-data/`，保障数据无缝过渡）。
- **开发调试**：开发环境自动隔离至 `dev-cache/` 子目录，拥有独立数据库与模板，绝不污染生产密钥与日常配置。
- **最近使用记录**：自动按最近调用模型智能排序，支持最多 100 条使用轨迹记录。
