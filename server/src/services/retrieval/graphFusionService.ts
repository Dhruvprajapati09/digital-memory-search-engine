import { env } from "../../config/env";
import type { FusedSearchHit } from "../search/hybridSearchService";
import type { GraphSearchHit } from "./graphRetrievalService";

export interface GraphFusionOptions {
  rrfK?: number;
  graphWeight?: number;
}

function graphRrfScore(rank: number, options?: GraphFusionOptions): number {
  const rrfK = options?.rrfK ?? env.RRF_K;
  const graphWeight = options?.graphWeight ?? env.GRAPH_RRF_WEIGHT;
  return graphWeight / (rrfK + rank + 1);
}

/**
 * Add graph retrieval as an independent retrieval leg.
 * Existing vector/keyword scores are preserved; graph scores only enrich or add
 * candidates discovered through graph traversal.
 */
export function fuseGraphSearchResults(
  fusedHits: FusedSearchHit[],
  graphHits: GraphSearchHit[],
  options?: GraphFusionOptions
): FusedSearchHit[] {
  if (graphHits.length === 0) return fusedHits;

  const byId = new Map<string, FusedSearchHit>();

  for (const hit of fusedHits) {
    byId.set(hit.vectorId, { ...hit });
  }

  graphHits.forEach((graphHit, rank) => {
    const existing = byId.get(graphHit.vectorId);
    const rrfScore = graphRrfScore(rank, options);

    if (existing) {
      byId.set(graphHit.vectorId, {
        ...existing,
        rrfScore: existing.rrfScore + rrfScore,
        graphScore: Math.max(existing.graphScore ?? 0, graphHit.graphScore),
        graphConfidence: Math.max(
          existing.graphConfidence ?? 0,
          graphHit.graphConfidence
        ),
        graphMatchedNodes: graphHit.graphMatchedNodes,
      });
      return;
    }

    byId.set(graphHit.vectorId, {
      ...graphHit,
      rrfScore,
    });
  });

  return [...byId.values()].sort((a, b) => {
    const scoreA = a.rrfScore + (a.graphScore ?? 0) * env.GRAPH_RRF_WEIGHT;
    const scoreB = b.rrfScore + (b.graphScore ?? 0) * env.GRAPH_RRF_WEIGHT;
    return scoreB - scoreA;
  });
}
