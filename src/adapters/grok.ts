import type { AdapterDefinition, AdapterRequestContext } from "./types.js";
import { sanitizeGrokPayload } from "./grok-core.js";

export const grokAdapter: AdapterDefinition = {
  id: "grok-responses-harness",
  beforeRequest(payload: unknown, context: AdapterRequestContext): void {
    if (!payload || typeof payload !== "object") throw new Error("Grok adapter received a non-object payload");
    const removed = sanitizeGrokPayload(payload as Record<string, unknown>, context.modelId, context.sessionId);
    console.info("[provider-mgr][grok] request", JSON.stringify({
      providerId: context.providerId,
      modelId: context.modelId,
      removed,
      cacheKeyLength: typeof (payload as any).prompt_cache_key === "string" ? Array.from((payload as any).prompt_cache_key).length : 0,
    }));
  },
  beforeHeaders(headers: Record<string, string>, context: AdapterRequestContext): void {
    if (!context.sessionId) {
      console.info("[provider-mgr][grok] headers", JSON.stringify({ providerId: context.providerId, modelId: context.modelId, conversationIdInjected: false }));
      return;
    }
    headers["x-grok-conv-id"] = context.sessionId;
    console.info("[provider-mgr][grok] headers", JSON.stringify({ providerId: context.providerId, modelId: context.modelId, conversationIdInjected: true, sessionIdLength: context.sessionId.length }));
  },
};
