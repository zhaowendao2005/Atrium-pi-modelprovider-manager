import type { ModelManagerItem, ModelMatchScore } from "./model-manager-types.js";

export function normalizeModelSearch(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s._\-/\\:]+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

export function orderedMatch(query: string, candidate: string): ModelMatchScore {
  const q = normalizeModelSearch(query);
  const text = normalizeModelSearch(candidate);
  if (!q) return { matched: true, tier: 0, density: 0, gaps: 0, span: 0, start: 0 };
  if (!text) return { matched: false, tier: 0, density: 0, gaps: Number.POSITIVE_INFINITY, span: Number.POSITIVE_INFINITY, start: -1 };

  let queryIndex = 0;
  let start = -1;
  let last = -1;
  let gaps = 0;
  let previous = -1;
  for (let i = 0; i < text.length && queryIndex < q.length; i++) {
    if (text[i] !== q[queryIndex]) continue;
    if (start < 0) start = i;
    if (previous >= 0) gaps += Math.max(0, i - previous - 1);
    previous = i;
    last = i;
    queryIndex++;
  }
  if (queryIndex !== q.length) return { matched: false, tier: 0, density: 0, gaps, span: Number.POSITIVE_INFINITY, start: -1 };

  const span = last - start + 1;
  const density = q.length / span;
  const tier = density === 1 ? 3 : density >= 0.5 ? 2 : 1;
  return { matched: true, tier, density, gaps, span, start };
}

function bestFieldScore(query: string, item: ModelManagerItem): { score: ModelMatchScore; weight: number } | undefined {
  const fields: Array<[string, number]> = [
    [item.modelId, 100],
    [item.modelName, 90],
    [item.series, 60],
    [item.providerId, 40],
    [item.providerName, 30],
  ];
  let best: { score: ModelMatchScore; weight: number } | undefined;
  for (const [value, weight] of fields) {
    const score = orderedMatch(query, value);
    if (!score.matched) continue;
    if (!best || compareMatchScore(score, weight, best.score, best.weight) < 0) best = { score, weight };
  }
  return best;
}

export function compareMatchScore(a: ModelMatchScore, aWeight: number, b: ModelMatchScore, bWeight: number): number {
  return (bWeight - aWeight) || (b.tier - a.tier) || (b.density - a.density) || (a.gaps - b.gaps) || (a.span - b.span) || (a.start - b.start);
}

export function scoreModel(query: string, item: ModelManagerItem): { score: ModelMatchScore; weight: number } | undefined {
  return bestFieldScore(query, item);
}

export function filterAndRankModels(query: string, items: ModelManagerItem[]): ModelManagerItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [...items].sort((a, b) => ((b.usedAt ?? 0) - (a.usedAt ?? 0)) || (a.providerOrder - b.providerOrder) || (a.modelOrder - b.modelOrder));
  return items
    .map((item, index) => ({ item, match: scoreModel(trimmed, item), index }))
    .filter((entry): entry is typeof entry & { match: NonNullable<typeof entry.match> } => Boolean(entry.match))
    .sort((a, b) => {
      const matchOrder = compareMatchScore(a.match.score, a.match.weight, b.match.score, b.match.weight);
      return matchOrder || ((b.item.usedAt ?? 0) - (a.item.usedAt ?? 0)) || (a.index - b.index);
    })
    .map((entry) => entry.item);
}