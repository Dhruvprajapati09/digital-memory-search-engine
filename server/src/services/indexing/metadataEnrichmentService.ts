import { createHash } from "crypto";
import { env } from "../../config/env";
import type {
  EnrichedChunkFields,
  SemanticChunk,
} from "../../types/documentIntelligence";
import {
  enrichChunkMetadata,
  buildSearchableText,
  type EnrichedChunkMetadata,
} from "../enrichment/chunkEnrichmentService";

/** Compute stable hash for incremental indexing */
export function computeChunkHash(text: string, metadata?: string): string {
  const payload = `${text}|${metadata ?? ""}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/** Detect document language from text heuristics */
export function detectLanguage(text: string): string {
  const sample = text.slice(0, 2000).toLowerCase();

  const englishMarkers =
    (sample.match(/\b(the|and|is|are|was|were|with|for|from)\b/g) ?? [])
      .length;

  if (englishMarkers >= 5) return "en";

  return "en";
}

export interface MetadataEnrichmentResult {
  chunk: SemanticChunk;
  enrichment: EnrichedChunkMetadata;
  fields: EnrichedChunkFields;
  searchableText: string;
}

/**
 * Enrich semantic chunks with full Phase 5 metadata.
 */
export function enrichSemanticChunkMetadata(
  chunk: SemanticChunk,
  embeddingModel: string
): MetadataEnrichmentResult {
  const baseEnrichment = enrichChunkMetadata(chunk);
  const language = chunk.language ?? detectLanguage(chunk.text);
  const embeddingVersion = env.EMBEDDING_VERSION;
  const embeddingDate = new Date();
  const chunkHash = computeChunkHash(
    chunk.text,
    `${chunk.title}|${chunk.sectionPath.join("/")}|${embeddingVersion}`
  );

  const entityNames = (chunk.entities ?? []).map((e) => e.name);
  const keywords = [
    ...new Set([...baseEnrichment.keywords, ...entityNames.map((n) => n.toLowerCase())]),
  ].slice(0, 20);

  const tags = [
    ...new Set([
      ...baseEnrichment.tags,
      ...(chunk.entities ?? []).map((e) => e.type),
      chunk.chapter?.toLowerCase(),
      chunk.section?.toLowerCase(),
    ].filter(Boolean) as string[]),
  ].slice(0, 20);

  const enrichment: EnrichedChunkMetadata = {
    ...baseEnrichment,
    keywords,
    tags,
  };

  const enrichedChunk: SemanticChunk = {
    ...chunk,
    language,
    chunkHash,
    embeddingVersion,
    indexVersion: env.INDEX_VERSION,
  };

  const entitySearchText = (chunk.entities ?? [])
    .map((e) => `${e.name} ${e.type}`)
    .join(" ");

  const relationshipSearchText = (chunk.relationships ?? [])
    .map((r) => `${r.source} ${r.type} ${r.target}`)
    .join(" ");

  const searchableText = [
    buildSearchableText(chunk, enrichment),
    chunk.chapter ?? "",
    chunk.section ?? "",
    chunk.heading ?? "",
    chunk.parentHeading ?? "",
    entitySearchText,
    relationshipSearchText,
    chunk.pageNumber !== undefined ? `page ${chunk.pageNumber}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const fields: EnrichedChunkFields = {
    keywords,
    concepts: baseEnrichment.concepts,
    tags,
    summary: baseEnrichment.summary,
    entities: chunk.entities ?? [],
    relationships: chunk.relationships ?? [],
    language,
    embeddingVersion,
    embeddingModel,
    embeddingDate,
    chunkHash,
    indexVersion: env.INDEX_VERSION,
  };

  return {
    chunk: enrichedChunk,
    enrichment,
    fields,
    searchableText,
  };
}

/** Batch enrich all chunks */
export function enrichAllSemanticChunks(
  chunks: SemanticChunk[],
  embeddingModel: string
): MetadataEnrichmentResult[] {
  return chunks.map((chunk) =>
    enrichSemanticChunkMetadata(chunk, embeddingModel)
  );
}
