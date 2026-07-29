import type {
  SearchV2Explanation,
  SearchV2RankedChunk,
} from "../../types/searchV2";

function rounded(value: number | undefined): number {
  return Math.round((value ?? 0) * 1000) / 1000;
}

function matchedFields(item: SearchV2RankedChunk): string[] {
  const fields: string[] = [];
  const chunk = item.chunk;

  if (chunk.vectorScore > 0) fields.push("semantic_vector");
  if (chunk.keywordScore > 0) fields.push("keyword_text");
  if (chunk.metadataScore > 0) fields.push("metadata");
  if ((chunk.graphScore ?? 0) > 0) fields.push("knowledge_graph");
  if (item.citationScore > 0) fields.push("citation_metadata");
  if ((chunk.crossEncoderScore ?? 0) > 0) fields.push("cross_encoder");

  return fields;
}

function whyRetrieved(item: SearchV2RankedChunk): string[] {
  const reasons: string[] = [];
  const chunk = item.chunk;

  if (chunk.vectorScore > 0) {
    reasons.push("Semantically similar to the rewritten query");
  }
  if (chunk.keywordScore > 0 || chunk.matchedKeywords.length > 0) {
    reasons.push("Matched query keywords or expanded terms");
  }
  if ((chunk.graphScore ?? 0) > 0) {
    reasons.push("Connected through the knowledge graph");
  }
  if (item.citationScore > 0) {
    reasons.push("Contains precise page, section, heading, or title metadata");
  }
  if (item.popularityScore > 0) {
    reasons.push("Aligned with recent user search patterns");
  }
  if ((chunk.crossEncoderScore ?? 0) > 0) {
    reasons.push("Validated by cross-encoder reranking");
  }

  return reasons.length > 0 ? reasons : ["Retrieved as a balanced hybrid match"];
}

export function buildSearchV2Explanation(
  item: SearchV2RankedChunk,
  rank: number
): SearchV2Explanation {
  const chunk = item.chunk;

  return {
    whyRetrieved: whyRetrieved(item),
    scores: {
      similarity: rounded(chunk.vectorScore),
      keyword: rounded(chunk.keywordScore),
      metadata: rounded(chunk.metadataScore),
      graph: rounded(chunk.graphScore),
      graphConfidence: chunk.graphConfidence,
      crossEncoder: chunk.crossEncoderScore,
      popularity: rounded(item.popularityScore),
      freshness: rounded(item.freshnessScore),
      final: rounded(item.learningScore),
    },
    rankingPosition: rank,
    matchedTerms: chunk.matchedKeywords,
    matchedEntities:
      chunk.graphMatchedNodes
        ?.filter((node) => node.type === "entity")
        .map((node) => node.label) ?? [],
    matchedFields: matchedFields(item),
  };
}
