# @vue-tui/runtime

The core renderer: the terminal primitives and the composables that read renderer-owned facts.

## Components

### `<Box>`

Layout container — flex, size, spacing, border, background, clipping, and `v-show`.

```vue
<script setup lang="ts">
import { Box } from "@vue-tui/runtime";
</script>

<template>
  <Box direction="column" padding="1" borderStyle="round">
    <Box direction="row" gap="1">
      <Text>Left</Text>
      <Text>Right</Text>
    </Box>
  </Box>
</template>
```

Props include: `direction`, `gap`, `padding`, `margin`, `width`, `height`, `borderStyle`, `borderColor`, `backgroundColor`, `clipping`, and more.

### `<Text>`

Text — foreground/background color, six modifiers, wrapping, truncation, and `v-show`.

```vue
<script setup lang="ts">
import { Text } from "@vue-tui/runtime";
</script>

<template>
  <Text color="green" bold>Hello World</Text>
  <Text color="blue" underline>Underlined</Text>
</template>
```

Props include: `color`, `backgroundColor`, `bold`, `italic`, `underline`, `strikethrough`, `inverse`, `dim`, `wrap`, `truncate`, and more.

### `<Static>`

Commits a mounted subtree to Inline terminal history. Import from `@vue-tui/runtime/inline`.

```vue
<script setup lang="ts">
import { Static } from "@vue-tui/runtime/inline";
</script>

<template>
  <Static>
    <Text>Committed to history</Text>
  </Static>
</template>
```

## Composables

### `useInput(handler, opts?)`

Normalized text, paste, and key events; `opts.isActive` gates the subscription.

```ts
import { useInput } from "@vue-tui/runtime";

useInput((event) => {
  if (event.type === "key") {
    if (event.key.name === "up") {
      // handle up arrow
    } else if (event.key.name === "down") {
      // handle down arrow
    } else if (event.key.name === "enter") {
      // handle enter
    } else if (event.key.name === "space") {
      // handle space
    }
  } else if (event.type === "text") {
    // handle text input
  } else if (event.type === "paste") {
    // handle paste
  }
});
```

### `useFocus(target?)`

One explicit focus identity, optionally bound to a rendered component.

```ts
import { ref, onMounted } from "vue";
import { useFocus, useInput } from "@vue-tui/runtime";

const inputRef = ref();
const focus = useFocus(inputRef);

onMounted(() => {
  focus.focus();
});

useInput((event) => {
  if (event.type === "text" && focus.isFocused) {
    // handle text input when focused
  }
});
```

### `useApp()`

Request normal or error exit from inside the tree.

```ts
import { useApp } from "@vue-tui/runtime";

const { exit } = useApp();

// Exit normally
exit();

// Exit with error
exit(new Error("Something went wrong"));
```

### `useLayoutSize()`

Readonly reactive root-layout size; `height` may be `Infinity`.

```ts
import { useLayoutSize } from "@vue-tui/runtime";

const { width, height } = useLayoutSize();

// Use in computed or template
console.log(`Terminal size: ${width.value}x${height.value}`);
```

### `useBoxMetrics(ref)`

Parent-relative metrics for one directly referenced `<Box>`.

```ts
import { ref } from "vue";
import { useBoxMetrics, Box } from "@vue-tui/runtime";

const boxRef = ref();
const metrics = useBoxMetrics(boxRef);

// metrics.width, metrics.height, metrics.left, metrics.top, metrics.hasMeasured
```

### `useStdin()`

Mounted stdin plus an independently owned raw-mode hold.

```ts
import { useStdin } from "@vue-tui/runtime";

const { stdin, isRawModeSupported, setRawMode } = useStdin();
```

## App Lifecycle

### `createApp()`

```ts
import { createApp } from "@vue-tui/runtime";

// Fire and forget (most common):
createApp(App).mount();

// Wait for the app to exit:
const app = createApp(App);
app.mount();
await app.waitUntilExit();

// Explicit host choices:
const app = createApp(App);
app.mount({
  mode: "fullscreen", // or "inline" (default)
  stdout: process.stdout,
  stdin: process.stdin,
  stderr: process.stderr,
  patchConsole: true,
  exitOnCtrlC: true,
  color: true, // or "ansi16" | "ansi256" | "truecolor" | false
});
```

### Mount Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `"inline" \| "fullscreen"` | `"inline"` | Terminal mode |
| `stdout` | `Writable` | `process.stdout` | Output stream |
| `stdin` | `Readable` | `process.stdin` | Input stream |
| `stderr` | `Writable` | `process.stderr` | Error stream |
| `patchConsole` | `boolean` | `true` | Route console output through the modeled writer |
| `exitOnCtrlC` | `boolean` | `false` | Exit before delivering an exact Ctrl+C key |
| `color` | `boolean \| ColorProfile` | `true` | Color capability |

### App Handle Methods

- `mount(options?)`: Mount the app
- `waitUntilExit()`: Promise that resolves after exit
- `waitUntilRenderFlush()`: Promise that resolves after render flush
- `unmount()`: Start teardown (synchronous)

## Render to String

```ts
import { renderToString } from "@vue-tui/runtime";

const document = renderToString(App, {
  width: 80,
  height: 24,
  color: true, // or false | "ansi16" | "ansi256" | "truecolor"
});
```

## Package Subpaths

- `@vue-tui/runtime` — common application surface
- `@vue-tui/runtime/inline` — contains only `Static`
- `@vue-tui/runtime/internal/devtools` — unsupported bridge for `@vue-tui/vite`
- `@vue-tui/runtime/internal/testing` — unsupported bridge for `@vue-tui/testing`

## License

MIT
