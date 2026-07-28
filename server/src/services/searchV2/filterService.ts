import type { RankedChunkHit } from "../../types/search";
import type {
  SearchV2AdvancedFilters,
  SearchV2SemanticFilters,
} from "../../types/searchV2";

function equalsIgnoreCase(value: unknown, expected?: string): boolean {
  return (
    typeof value === "string" &&
    typeof expected === "string" &&
    value.toLowerCase() === expected.toLowerCase()
  );
}

function containsIgnoreCase(values: unknown, expected?: string): boolean {
  if (!expected) return true;
  if (typeof values === "string") return values.toLowerCase().includes(expected.toLowerCase());
  if (!Array.isArray(values)) return false;
  return values.some(
    (value) => typeof value === "string" && value.toLowerCase() === expected.toLowerCase()
  );
}

function chunkMatchesUserFilters(
  chunk: RankedChunkHit,
  filters?: SearchV2AdvancedFilters
): boolean {
  if (!filters) return true;

  if (filters.documentId && chunk.documentId !== filters.documentId) return false;
  if (filters.documentIds && filters.documentIds.length > 0) {
    if (!filters.documentIds.includes(chunk.documentId)) return false;
  }
  if (filters.page !== undefined && chunk.metadata.pageNumber !== filters.page) {
    return false;
  }
  if (filters.chapter && !equalsIgnoreCase(chunk.metadata.chapter, filters.chapter)) {
    return false;
  }
  if (filters.section && !equalsIgnoreCase(chunk.metadata.section, filters.section)) {
    return false;
  }
  if (filters.heading && !equalsIgnoreCase(chunk.metadata.heading, filters.heading)) {
    return false;
  }
  if (filters.language && !equalsIgnoreCase(chunk.metadata.language, filters.language)) {
    return false;
  }
  if (filters.fileType && chunk.metadata.type !== filters.fileType) return false;
  if (filters.entity && !containsIgnoreCase(
    chunk.metadata.entities?.map((entity) => entity.name),
    filters.entity
  )) {
    return false;
  }
  if (filters.topic && !equalsIgnoreCase(chunk.topic, filters.topic)) return false;
  if (filters.tags && filters.tags.length > 0) {
    const chunkTags = chunk.tags ?? [];
    if (!filters.tags.every((tag) => containsIgnoreCase(chunkTags, tag))) {
      return false;
    }
  }

  return true;
}

function chunkMatchesSemanticFilters(
  chunk: RankedChunkHit,
  filters: SearchV2SemanticFilters
): boolean {
  const tags = chunk.tags ?? [];
  const entityNames = chunk.metadata.entities?.map((entity) => entity.name) ?? [];

  if (filters.language && equalsIgnoreCase(chunk.metadata.language, filters.language)) {
    return true;
  }
  if (filters.framework && containsIgnoreCase(tags, filters.framework)) {
    return true;
  }
  if (filters.entity && containsIgnoreCase(entityNames, filters.entity)) {
    return true;
  }
  if (filters.topic && equalsIgnoreCase(chunk.topic, filters.topic)) {
    return true;
  }
  if (filters.tags.some((tag) => containsIgnoreCase(tags, tag))) {
    return true;
  }

  return false;
}

export function applySearchV2Filters(
  chunks: RankedChunkHit[],
  userFilters: SearchV2AdvancedFilters | undefined,
  semanticFilters: SearchV2SemanticFilters
): { chunks: RankedChunkHit[]; semanticFilterApplied: boolean } {
  const hardFiltered = chunks.filter((chunk) =>
    chunkMatchesUserFilters(chunk, userFilters)
  );

  const hasSemanticFilter = Boolean(
    semanticFilters.language ||
      semanticFilters.framework ||
      semanticFilters.entity ||
      semanticFilters.topic ||
      semanticFilters.tags.length > 0
  );

  if (!hasSemanticFilter || hardFiltered.length === 0) {
    return { chunks: hardFiltered, semanticFilterApplied: false };
  }

  const semanticFiltered = hardFiltered.filter((chunk) =>
    chunkMatchesSemanticFilters(chunk, semanticFilters)
  );

  if (semanticFiltered.length === 0) {
    return { chunks: hardFiltered, semanticFilterApplied: false };
  }

  return { chunks: semanticFiltered, semanticFilterApplied: true };
}
