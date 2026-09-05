import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface AdapterRequestContext {
  modelId: string;
  providerId: string;
  sessionId?: string | null;
  cwd?: string;
  extensionContext: ExtensionContext;
}

export interface AdapterPolicy {
  adapterId: string;
  source: "provider-preset" | "model-preset";
  presetId: string;
  injectConversationId?: boolean;
}

export interface AdapterDefinition {
  id: string;
  beforeRequest(payload: unknown, context: AdapterRequestContext): void;
  beforeHeaders(headers: Record<string, string>, context: AdapterRequestContext): void;
}
