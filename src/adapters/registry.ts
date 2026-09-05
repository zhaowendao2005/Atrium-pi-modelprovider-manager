import type { AdapterDefinition } from "./types.js";
import { grokAdapter } from "./grok.js";

const GROK_PRESETS = new Set([
  "xai", "grok-4.6", "grok-composer-2.5-fast", "grok-build", "grok-4.5", "grok-4.3",
  "grok-4.20-0309-reasoning", "grok-4.20-0309-non-reasoning", "grok-4.20-multi-agent-0309",
]);

export const adapterRegistry: AdapterDefinition[] = [grokAdapter];

export function adapterForPreset(presetId: string | undefined): AdapterDefinition | undefined {
  const normalized = presetId?.trim().toLowerCase();
  if (!normalized || !GROK_PRESETS.has(normalized)) return undefined;
  return grokAdapter;
}
