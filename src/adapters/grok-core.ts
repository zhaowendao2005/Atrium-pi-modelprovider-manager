const MAX_CACHE_KEY_LENGTH = 64;
const REASONING_MODELS = ["grok-3-mini", "grok-4.20-multi-agent", "grok-4.6", "grok-4.5", "grok-4.3"];
const VALID_CONTENT_TYPES = new Set(["input_text", "output_text", "text", "input_image"]);

export function clampCacheKey(key: unknown): string | undefined {
  if (typeof key !== "string") return undefined;
  const value = key.trim();
  return value ? Array.from(value).slice(0, MAX_CACHE_KEY_LENGTH).join("") : undefined;
}

export function ensurePromptCacheKey(payload: Record<string, unknown>, sessionId?: string | null): void {
  const current = clampCacheKey(payload.prompt_cache_key);
  const fallback = clampCacheKey(sessionId);
  if (current) payload.prompt_cache_key = current;
  else if (fallback) payload.prompt_cache_key = fallback;
  else delete payload.prompt_cache_key;
}

export function supportsReasoning(modelId: string): boolean {
  const id = modelId.toLowerCase().split("/").pop() || "";
  return REASONING_MODELS.some((prefix) => id.startsWith(prefix));
}

export function ensureEncryptedReasoningInclude(payload: Record<string, unknown>, modelId: string): void {
  if (!supportsReasoning(modelId) || modelId.toLowerCase().startsWith("grok-build")) return;
  const value = "reasoning.encrypted_content";
  const include = Array.isArray(payload.include) ? payload.include : [];
  if (!include.includes(value)) payload.include = [...include, value];
}

export function normalizeInput(input: unknown[]): void {
  for (const item of input) {
    if (!item || typeof item !== "object" || !(item as any).role) continue;
    const content = (item as any).content;
    const empty = content == null || content === "" || (Array.isArray(content) && content.length === 0) ||
      (typeof content === "string" && !content.trim());
    const invalid = Array.isArray(content) && !content.some((part: any) =>
      part && typeof part === "object" && (typeof part.text === "string" || VALID_CONTENT_TYPES.has(part.type)));
    if (empty || invalid) {
      (item as any).content = [{
        type: (item as any).role === "assistant" ? "output_text" : "input_text",
        text: "",
      }];
    }
  }
}

export function rewriteProviderInput(payload: Record<string, unknown>): void {
  if (!Array.isArray(payload.input)) return;
  const input = payload.input as any[];
  normalizeInput(input);
  const instructions: string[] = [];
  while (input.length && (input[0]?.role === "system" || input[0]?.role === "developer")) {
    const message = input.shift();
    const content = message.content;
    const text = typeof content === "string" ? content : Array.isArray(content)
      ? content.map((part: any) => typeof part === "string" ? part : part?.text || "").join(" ")
      : "";
    if (text.trim()) instructions.push(text.trim());
  }
  if (instructions.length) {
    payload.instructions = payload.instructions
      ? `${String(payload.instructions)}\n\n${instructions.join("\n\n")}`
      : instructions.join("\n\n");
  }
  payload.input = input;
}

export function stripSlashEnums(tools: unknown[]): void {
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.enum) && record.enum.some((item) => typeof item === "string" && item.includes("/"))) delete record.enum;
    Object.values(record).forEach(walk);
  };
  tools.forEach(walk);
}

export function sanitizeGrokPayload(payload: Record<string, unknown>, modelId: string, sessionId?: string | null): string[] {
  const removed: string[] = [];
  for (const key of ["seed", "parallel_tool_calls", "prompt_cache_retention", "service_tier"]) {
    if (key in payload) { delete payload[key]; removed.push(key); }
  }
  if (Array.isArray(payload.tools)) {
    stripSlashEnums(payload.tools);
    if (!payload.tools.length) { delete payload.tools; removed.push("tools(empty)"); }
  }
  if (typeof payload.temperature === "number") payload.temperature = Math.max(0, Math.min(2, payload.temperature));
  if (typeof payload.top_p === "number") payload.top_p = Math.max(0, Math.min(1, payload.top_p));
  if (payload.reasoning && typeof payload.reasoning === "object") {
    if (!supportsReasoning(modelId)) { delete payload.reasoning; removed.push("reasoning"); }
    else {
      const effort = (payload.reasoning as any).effort;
      payload.reasoning = typeof effort === "string" ? { effort } : undefined;
      if (!payload.reasoning) { delete payload.reasoning; removed.push("reasoning(empty)"); }
    }
  }
  rewriteProviderInput(payload);
  ensureEncryptedReasoningInclude(payload, modelId);
  ensurePromptCacheKey(payload, sessionId);
  return removed;
}
