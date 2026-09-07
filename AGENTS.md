# AGENTS.md

欢迎来到 **Pi 模型提供商管理器（Pi Model Provider Manager）** 代码库。

本仓库同时提供两类产品：

1. **Pi 编码智能体扩展**（面向 Pi 的 TypeScript 运行时扩展）。
2. **桌面可视化管理应用**（Tauri + Vue 3 + Tailwind CSS + Pinia）。

---

## 🧭 设计与开发规范

在本仓库工作的所有 AI 智能体与开发者，**必须**严格遵循以下架构与设计规则：

- 📖 **前端架构与设计标准**：在进行任何 UI 或架构改动之前，请阅读并遵循 [dev_docs/rules/前端设计规范和范式.md](file:///D:/code/javascript/pi-extension/pi-modelprovider-manager/dev_docs/rules/%E5%89%8D%E7%AB%AF%E8%AE%BE%E8%AE%A1%E8%A7%84%E8%8C%83%E5%92%8C%E8%8C%83%E5%BC%8F.md)。

### 关键规则摘要：
1. **禁止使用 Emoji**：所有视觉图标与指示一律使用矢量 SVG（如 `lucide-vue-next` 或内联 SVG）。在 UI 与源码中严格禁止使用 Emoji。
2. **Apple / iOS 设计美学**：可折叠侧边栏、干净整洁的 Apple 风格自定义滚动条（`AppleScrollArea`）、圆角卡片、平滑过渡。
3. **状态管理**：全局状态与窗口状态管理必须使用 **Pinia**（`src/stores/` 与 `src/stores/windows/`）。禁止滥用局部 Vue `ref` 来处理跨组件状态。
4. **组件与视图边界**：高复用度的 UI 控件放在 `src/components/ui/`；页面专属组件放在 `src/views/<页面名>/components/`。
5 数据存储使用sqlite数据库，configyaml已弃用，所有配置数据存储在sqlite数据库中，禁止使用yaml文件存储配置数据。

## 提示性和参考资料（仅用于提供背景信息，非强制需求，他们很多事我们根据网上的资料浓缩和提取的
- 📖 **模型与提供商协议参考**：请参考 [dev_docs/analysis_result/模型与提供商规范分析.md](file:///D:/code/javascript/pi-extension/pi-modelprovider-manager/dev_docs/analysis_result/%E6%A8%A1%E5%9E%8B%E4%B8%8E%E6%8F%90%E4%BE%9B%E5%95%86%E8%A7%84%E8%8C%83%E5%88%86%E6%9E%90.md)，其中包含了 9 种线上协议、兼容性矩阵及思考等级（thinking level）映射。