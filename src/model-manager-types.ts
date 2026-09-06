import type { ModelSchema, ProviderSchema } from "./types/index.js";

export interface RecentModelUse {
  providerId: string;
  modelId: string;
  usedAt: number;
}

export interface ModelManagerItem {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  series: string;
  providerOrder: number;
  modelOrder: number;
  usedAt?: number;
  isCurrent: boolean;
  provider: ProviderSchema;
  model: ModelSchema;
}

export interface ModelMatchScore {
  matched: boolean;
  tier: number;
  density: number;
  gaps: number;
  span: number;
  start: number;
}

export interface ModelManagerData {
  items: ModelManagerItem[];
  currentProviderId?: string;
  currentModelId?: string;
  recent: RecentModelUse[];
}