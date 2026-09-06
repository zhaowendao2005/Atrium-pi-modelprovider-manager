# Pi Model Provider Manager

**Pi Model Provider Manager** 是专为 **Pi (pi-coding-agent)** 打造的多模型与中转站管理器，包含：
1. **Pi Agent 运行时扩展 (Extension)**：只读读取 `~/.pi/pi-modelprovider-manager-data/manager.db`，注册 Provider / Model，并执行有效配置、请求 hooks、adapter、补丁、上下文溢出自动恢复与链路追踪。
2. **桌面端可视化管理面板 (Tauri + Vue 3 + Tailwind CSS + Pinia)**：采用 Apple / iOS 极简设计美学，提供可伸缩侧边栏、苹果风格自定义滚动条、模型系列分组展示及抽屉式（Drawer）参数配置。

---

## 🧭 架构与设计规范

- 📖 **前端设计规范与范式**：参见 [docs/rules/前端设计规范和范式.md](file:///D:/code/javascript/pi-extension/pi-modelprovider-manager/docs/rules/%E5%89%8D%E7%AB%AF%E8%AE%BE%E8%AE%A1%E8%A7%84%E8%8C%83%E5%92%8C%E8%8C%83%E5%BC%8F.md)。
- 📖 **底层协议与规范分析**：参见 [docs/analysis_result/模型与提供商规范分析.md](file:///D:/code/javascript/pi-extension/pi-modelprovider-manager/docs/analysis_result/%E6%A8%A1%E5%9E%8B%E4%B8%8E%E6%8F%90%E4%BE%9B%E5%95%86%E8%A7%84%E8%8C%83%E5%BC%8F%E5%88%86%E6%9E%90.md)。
- 📖 **运行时职责**：Tauri 管理器负责复杂配置，Pi Extension 负责 Provider / Model 注册、hooks、patch 和 adapter，`/models` 与 `Alt+P` 提供快速模型选择 TUI。

---

## 📦 最终打包产物结构 (`dist/`)

运行 `pnpm build` 命令将一键构建并将 **插件包产物** 与 **Tauri 二进制可执行文件** 输出到 `dist/` 目录：

```
dist/
└── pi-modelprovider-manager/ # 标准 Pi Agent 插件使用单元
    ├── index.js              # Pi Agent Extension 插件编译产物
    ├── index.d.ts            # TypeScript 完整类型定义声明文件
    ├── index.js.map          # SourceMap 调试文件
    ├── bin/                  # Tauri 桌面端二进制程序产物
    │   └── pi-modelprovider-manager.exe
    └── ui/                   # 桌面端 / Web 前端静态资源
        ├── index.html
    └── assets/
        ├── index-*.css       # Tailwind + iOS 主题样式包
        └── index-*.js        # Vue 3 + Pinia + 组件逻辑包
```

---

## ⚙️ 构建与开发命令列表

| 命令 | 执行动作 | 说明 |
| :--- | :--- | :--- |
| **`pnpm build`** | `pnpm clean && pnpm build:ext && pnpm build:tauri && pnpm assemble:plugin` | **一键全量打包**：输出 `dist/pi-modelprovider-manager/` 标准插件单元，包含 Extension、UI 和 Tauri 可执行文件 |
| **`pnpm build:ext`** | `tsup` | **仅构建 Extension 插件包**：生成待组装的 `dist/index.js` 与 `dist/index.d.ts` |
| **`pnpm build:ui`** | `vue-tsc --noEmit && vite build` | **仅构建 UI 静态资源**：类型检查并输出至 `dist/ui/` |
| **`pnpm build:tauri`** | `tauri build --no-bundle && copy-binary` | **仅编译 Tauri 二进制可执行程序**并暂存到 `dist/bin/` |
| **`pnpm build:no-tauri`**| `pnpm clean && pnpm build:ext && pnpm build:ui && pnpm assemble:plugin` | 快速构建插件与前端（跳过 Rust 编译） |
| **`pnpm clean`** | `rimraf dist` | 清理 `dist/` 构建目录 |
| **`pnpm dev`** | `tauri dev` | 启动 Tauri 桌面端开发环境（同时自动启动前端开发服务器） |
| **`pnpm dev:ui`** | `vite` | 仅启动本地 Web 前端热重载开发服务器 (http://localhost:8632) |
| **`pnpm tauri dev`** | `tauri dev` | 启动本地 Tauri 桌面端开发环境 |

---

## 🚀 插件加载与使用方式

### 方式 1：使用已构建的产物直接加载
```bash
pi -e ./dist/pi-modelprovider-manager/index.js
```

### 方式 2：放入 Pi 自动发现目录（支持 `/reload`）
- **全局路径**：`~/.pi/agent/extensions/pi-modelprovider-manager/`
- **项目级路径**：`.pi/extensions/pi-modelprovider-manager/`

### 方式 3：运行桌面管理程序
直接双击运行 `./dist/pi-modelprovider-manager/bin/pi-modelprovider-manager.exe` 打开可视化配置管理器；在 Pi Agent 内执行 `/model-manager` 也会启动同一个管理器。管理器使用单实例锁，重复执行不会创建第二个窗口。
