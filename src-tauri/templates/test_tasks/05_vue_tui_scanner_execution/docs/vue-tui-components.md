# @vue-tui/components

High-level Vue components for vue-tui, composed from `@vue-tui/runtime` primitives.

Currently: `Newline`, `Spacer`, `Spinner`, `ScrollBox`, and `Table`.

## Install

```sh
npm install @vue-tui/components
# peer deps: @vue-tui/runtime, vue ^3.5
```

## Table

A bordered table for object rows. Omit `columns` to display the union of row keys, or provide typed columns to choose order, labels, alignment, wrapping, string formatting, and structured text presentation.

```vue
<script setup lang="ts">
import { Table } from "@vue-tui/components";
</script>

<template>
  <Table :data="rows" />
</template>
```

### Props

| prop | type | default | description |
| --- | --- | --- | --- |
| `data` | `readonly Row[]` | required | object rows to render |
| `columns` | `readonly TableColumn[]` | row keys | ordered keys with optional label, alignment, wrapping, formatting, and text styles |
| `padding` | non-negative safe integer | `1` | spaces on each side of a cell |

## Spinner

An animated loading spinner.

```vue
<script setup lang="ts">
import { Spinner } from "@vue-tui/components";
</script>

<template>
  <Spinner type="dots" label="Loading..." />
</template>
```

### Props

| prop | type | default | description |
| --- | --- | --- | --- |
| `type` | preset name (e.g. `"dots"`, `"line"`) | `"dots"` | a built-in spinner animation |
| `frames` | `string[]` | — | custom animation frames (overrides `type`) |
| `interval` | `number` | preset's | ms between frames |
| `color` | `Color` from `@vue-tui/runtime` | — | terminal color for the spinner glyph |
| `label` | `string` | — | text shown next to the spinner |

## ScrollBox

A bounded viewport that follows the bottom of its content. The core behavior — clip overflow and stick to the latest line as content grows — needs no props. It listens to **no** input itself: scroll it through the exposed imperative handle, and bind your own keys or mouse to that.

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ScrollBox } from "@vue-tui/components";
import { useInput } from "@vue-tui/runtime";

const scrollBox = ref<InstanceType<typeof ScrollBox>>();

useInput((event) => {
  if (event.type === "key") {
    if (event.key.name === "down") {
      scrollBox.value?.scrollByLines(1);
    } else if (event.key.name === "up") {
      scrollBox.value?.scrollByLines(-1);
    }
  }
});
</script>

<template>
  <ScrollBox ref="scrollBox">
    <template v-for="line in lines" :key="line">
      <Text>{{ line }}</Text>
    </template>
  </ScrollBox>
</template>
```

### Imperative handle (`ScrollBoxExpose`)

| action | result | description |
| --- | --- | --- |
| `scrollToLine(line)` | `boolean` | scroll a finite line to the top after flooring and clamping |
| `scrollByLines(lines)` | `boolean` | scroll by a finite number of lines relative to the current position (`+` down) |
| `scrollToTop()` | `boolean` | jump to the top |
| `scrollToBottom()` | `boolean` | jump to the bottom and resume following new content |

Every method returns `true` only when the effective top content line changes synchronously.

Why no built-in `wheel` or `keyboard`: the mouse wheel needs terminal mouse tracking, which breaks native text selection window-wide; keyboard input is application-wide and can collide with an editor. The application therefore decides input policy.

## Newline

Emits `count` newline characters inside a `<Text>`.

## Spacer

A growing `Box` that fills the free main-axis space.

## License

MIT
