import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/adapters/grok-core.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: false,
  splitting: false,
  outDir: "dist",
  target: "es2022",
  external: [
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-ai",
    "@earendil-works/pi-tui",
    "@sinclair/typebox",
    "typebox",
    "node:sqlite",
  ],
});
