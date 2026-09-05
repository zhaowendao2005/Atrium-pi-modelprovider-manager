import type { ModelSchema, ProviderSchema } from "../types/index.js";
import { adapterForPreset } from "./registry.js";
import type { AdapterPolicy } from "./types.js";

export function resolveAdapterPolicy(provider: ProviderSchema, model: ModelSchema): AdapterPolicy | undefined {
  const providerAdapter = adapterForPreset(provider.appliedPreset);
  if (providerAdapter) return { adapterId: providerAdapter.id, source: "provider-preset", presetId: provider.appliedPreset! };
  const modelAdapter = adapterForPreset(model.appliedPreset);
  if (modelAdapter) return { adapterId: modelAdapter.id, source: "model-preset", presetId: model.appliedPreset! };
  return undefined;
}

export { adapterForPreset };
