import type { RecentModelUse } from "./model-manager-types.js";

export const RECENT_MODELS_META_KEY = "model_manager_recent_usage";
const MAX_RECENT = 100;

export function parseRecentModels(value: unknown): RecentModelUse[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is RecentModelUse => Boolean(entry && typeof entry === "object" && typeof entry.providerId === "string" && typeof entry.modelId === "string" && typeof entry.usedAt === "number"))
    .sort((a, b) => b.usedAt - a.usedAt)
    .slice(0, MAX_RECENT);
}

export function recordRecentModel(recent: RecentModelUse[], providerId: string, modelId: string, usedAt = Date.now()): RecentModelUse[] {
  return [{ providerId, modelId, usedAt }, ...recent.filter((entry) => !(entry.providerId === providerId && entry.modelId === modelId))].slice(0, MAX_RECENT);
}

export function recentKey(providerId: string, modelId: string): string {
  return `${providerId}\0${modelId}`;
}
