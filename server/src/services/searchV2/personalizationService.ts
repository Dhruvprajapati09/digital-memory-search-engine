import { getSearchHistoryRecords } from "../searchHistoryService";
import type { RankedChunkHit } from "../../types/search";

export interface PersonalizationSignals {
  recentQueries: string[];
  queryAffinityTerms: string[];
  documentBoosts: Map<string, number>;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^\w.-]/g, ""))
    .filter((term) => term.length >= 3);
}

export async function loadPersonalizationSignals(
  userId: string
): Promise<PersonalizationSignals> {
  const history = await getSearchHistoryRecords(userId);
  const recentQueries = history.map((item) => item.query);
  const affinity = new Map<string, number>();

  recentQueries.slice(0, 10).forEach((query, index) => {
    const weight = 1 / (index + 1);
    for (const term of tokenize(query)) {
      affinity.set(term, (affinity.get(term) ?? 0) + weight);
    }
  });

  return {
    recentQueries,
    queryAffinityTerms: [...affinity.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term)
      .slice(0, 20),
    documentBoosts: new Map(),
  };
}

export function computePersonalizationScore(
  chunk: RankedChunkHit,
  signals: PersonalizationSignals
): number {
  const explicitBoost = signals.documentBoosts.get(chunk.documentId) ?? 0;
  const haystack = [
    chunk.title,
    chunk.topic,
    chunk.subtopic,
    chunk.summary,
    ...(chunk.keywords ?? []),
    ...(chunk.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matches = signals.queryAffinityTerms.filter((term) =>
    haystack.includes(term)
  ).length;

  return Math.min(1, explicitBoost + matches / 8);
}
