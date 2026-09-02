# AGENTS.md

Welcome to the **Pi Model Provider Manager** codebase.

This repository provides both:
1. **Pi Coding Agent Extension** (TypeScript runtime extension for Pi).
2. **Desktop Visual Management App** (Tauri + Vue 3 + Tailwind CSS + Pinia).

---

## 🧭 Design & Development Guidelines

All AI agents and developers working on this repository **MUST** strictly adhere to the following architecture and design rules:

- 📖 **Frontend Architecture & Design Standards**: Please read and follow [docs/rules/前端设计规范和范式.md](file:///D:/code/javascript/pi-extension/pi-modelprovider-manager/docs/rules/%E5%89%8D%E7%AB%AF%E8%AE%BE%E8%AE%A1%E8%A7%84%E8%8C%83%E5%92%8C%E8%8C%83%E5%BC%8F.md) before making UI or architecture changes.
- 📖 **Model & Provider Protocol Reference**: Refer to [docs/analysis_result/模型与提供商规范分析.md](file:///D:/code/javascript/pi-extension/pi-modelprovider-manager/docs/analysis_result/%E6%A8%A1%E5%9E%8B%E4%B8%8E%E6%8F%90%E4%BE%9B%E5%95%86%E8%A7%84%E8%8C%83%E5%88%86%E6%9E%90.md) for 9 wire protocols, compat matrices, and thinking level mappings.

### Key Rules Summary:
1. **No Emojis**: All visual icons and indicators must use vector SVGs (e.g. `lucide-vue-next` or inline SVGs). Emojis are strictly prohibited in the UI and source code.
2. **Apple / iOS Design Aesthetic**: Collapsible sidebar, clean Apple-style custom scrollbars (`AppleScrollArea`), rounded cards, smooth transitions.
3. **State Management**: Mandatory use of **Pinia** for global & window state management (`src/stores/` and `src/stores/windows/`). Do not abuse local Vue `ref` for cross-component state.
4. **Component vs View Boundary**: Highly reusable UI controls reside in `src/components/ui/`; page-specific components reside in `src/views/<page-name>/components/`.
5. **Persistence**: YAML format stored at `~/.pi/pi-modelprovider-manager-data/config.yaml`.
