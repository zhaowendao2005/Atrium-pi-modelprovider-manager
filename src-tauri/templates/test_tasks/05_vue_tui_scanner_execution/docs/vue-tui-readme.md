# vue-tui

**Public beta** — the `@vue-tui/runtime` API is stabilizing toward 1.0; dev-mode HMR is still experimental.

vue-tui is a Vue-native application framework for interactive terminal UIs. Build with components, develop with HMR, test with confidence.

## Quick Start

### 1. Create a standalone TUI application (recommended)

Use this scaffold for a standalone TUI application that controls the Node process and terminal. The Vite config defines the application entry. During development, `@vue-tui/vite` starts this entry and provides HMR. During a production build, it configures Vite to create one Node file.

```bash
pnpm dlx tiged vuejs-ai/vue-tui/templates/vite my-app
cd my-app
pnpm install
pnpm dev # in-process terminal dev server with HMR
pnpm build # Vite builds dist/main.mjs
pnpm build:exe # Vite builds first, then tsdown creates build/main (requires Node.js 26 or later)
pnpm preview # build, then run the production bundle
```

Edit `src/app.vue` and watch the terminal update instantly.

### 2. Embed the runtime

Use the runtime directly when vue-tui is part of an existing Node application. The host application uses its existing compiler, build, entry, and process lifecycle without `@vue-tui/vite`.

```ts
// main.ts
import { createApp } from "@vue-tui/runtime";
import App from "./app.vue";
createApp(App).mount({ exitOnCtrlC: true });
```

## Packages

| Package | Description |
| --- | --- |
| `@vue-tui/runtime` | Vue 3 renderer for terminal applications. Provides core components, layout, input, focus, and lifecycle APIs. |
| `@vue-tui/use` | Composables and components that use only public Runtime APIs. |
| `@vue-tui/vite` | `vueTui()` provides terminal HMR and default Vite settings for a standalone Node bundle. |
| `@vue-tui/testing` | Deterministic host for component tests. Tests can inspect renderer frames or the emulated terminal screen. |
| `@vue-tui/components` | Provides `<ScrollBox>`, `<Spinner>`, `<Table>`, `<Newline>`, and `<Spacer>`. |

## Examples

| Example | Description |
| --- | --- |
| `basic-template` | Vue SFC with `<template>` syntax |
| `basic-jsx` | Same app in TSX |
| `coding-agent` | AI coding agent with LLM streaming and interactive UI |
| `flappy-bird` | Physics-based terminal game with reactive state and borders |
| `scroll-box` | Bounded viewport with app-controlled scrolling |

## `@vue-tui/runtime`

### Components

| Component | Import from | Description |
| --- | --- | --- |
| `<Box>` | `@vue-tui/runtime` | Layout container — flex, size, spacing, border, background, clipping, and `v-show` |
| `<Text>` | `@vue-tui/runtime` | Text — foreground/background color, six modifiers, wrapping, truncation, and `v-show` |
| `<Static>` | `@vue-tui/runtime/inline` | Commits a mounted subtree to Inline terminal history |

`Box` and `Text` have closed prop surfaces: unknown props, misspellings, browser attributes, and listeners such as `@click` are rejected at runtime instead of silently ignored.

### Composables

Each one must be called inside a mounted render tree.

| Composable | Returns | Description |
| --- | --- | --- |
| `useInput(handler, opts?)` | — | Normalized text, paste, and key events; `opts.isActive` gates the subscription |
| `useFocus(target?)` | `{ isFocused, focus, blur }` | One explicit focus identity, optionally bound to a rendered component |
| `useApp()` | `{ exit }` | Request normal or error exit from inside the tree |
| `useLayoutSize()` | `{ width, height }` | Readonly reactive root-layout size; `height` may be `Infinity` |
| `useStdin()` | `{ stdin, isRawModeSupported, setRawMode }` | Mounted stdin plus an independently owned raw-mode hold |
| `useBoxMetrics(ref)` | `{ width, height, left, top, hasMeasured }` | Parent-relative metrics for one directly referenced `<Box>` |

`useInput()` delivers one frozen event per input:

| `event.type` | Payload |
| --- | --- |
| `"text"` | Non-empty `text`, plus a nested `key` when the terminal supplied reliable identity |
| `"key"` | A required nested `key` and no text |
| `"paste"` | One complete payload, possibly empty, and no key |

A `key` carries exactly one normalized `name` or one logical `character`, plus `shift`, `alt`, `ctrl`, `meta`, `super`, and `hyper` booleans.

Every active subscription receives every event and handler return values are ignored, so nothing consumes input or steers routing. Focus composes directly as `useInput(handler, { isActive: focus.isFocused })`.

## `@vue-tui/use`

### Composables

| Composable | Returns | Description |
| --- | --- | --- |
| `useKeyInput(handler, opts?)` | — | Key-only events such as arrows, function keys, and modified shortcuts |
| `useTextInput(handler, opts?)` | — | Text events only; enhanced input preserves its optional logical-key information |
| `useInputWhileMounted(handler, opts?)` | `targetRef` | Global input, optionally filtered by `opts.type`, while one directly referenced vnode remains mounted |

### Components

| Component | Import from | Description |
| --- | --- | --- |
| `<UseInputWhileMounted type?>` | `@vue-tui/use/components` | Emits global input, optionally filtered by `type`, while mounted and renders only its default slot |

## `@vue-tui/components`

| Component | Description |
| --- | --- |
| `<ScrollBox>` | Bounded sticky-bottom viewport; the app drives scrolling through its imperative handle |
| `<Spinner>` | Animated loading spinner — `dots` / `line` presets or custom frames, optional label |
| `<Table>` | Non-interactive, terminal-width-aware bordered table for typed object rows |
| `<Newline>` | Emits `count` newline characters inside a `<Text>` |
| `<Spacer>` | A growing `Box` that fills the free main-axis space |

## `@vue-tui/testing`

```ts
import { render } from "@vue-tui/testing";
const result = await render(App, { mode: "inline", columns: 100, rows: 100 });
expect(result.lastFrame()).toContain("...");
result.dispose();
```

## App Lifecycle

```ts
import { createApp } from "@vue-tui/runtime";

// Fire and forget (most common):
createApp(App).mount();

// Wait for the app to exit:
const app = createApp(App);
app.mount();
await app.waitUntilExit();

// Explicit host choices:
const fullscreen = createApp(App);
fullscreen.mount({
  mode: "fullscreen",
  stdout,
  stdin,
  stderr,
  patchConsole: true,
  exitOnCtrlC: true,
});
```

The returned app handle owns two barriers: `waitUntilRenderFlush()` and `waitUntilExit()`.

## Render to string

```ts
import { renderToString } from "@vue-tui/runtime";
const document = renderToString(App, { width: 80, height: 24 });
```

## License

MIT
