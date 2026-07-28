import { env } from "../../config/env";
import type {
  DocumentIntelligenceInput,
  DocumentIntelligenceResult,
  PageContent,
} from "../../types/documentIntelligence";
import { analyzeLayout } from "./layoutAnalysisService";
import { buildDocumentStructure } from "./documentStructureService";
import {
  extractPdfPages,
  mapExtractionPagesToContent,
  splitTextIntoEstimatedPages,
} from "./pageExtractionService";
import { createSemanticChunks } from "./semanticChunkingService";
import {
  extractEntitiesFromChunks,
  aggregateDocumentEntities,
} from "./entityExtractionService";
import {
  extractRelationshipsFromChunks,
  aggregateDocumentRelationships,
} from "./relationshipExtractionService";
import { detectLanguage } from "./metadataEnrichmentService";
import type { PageExtractionData } from "../../types/extraction.types";

export interface DocumentIntelligenceOptions {
  preExtractedPages?: PageExtractionData[];
  totalPages?: number;
}

/**
 * Orchestrate Phase 5 document intelligence pipeline.
 * Reuses existing structure parser as fallback; does not modify retrieval.
 */
export async function runDocumentIntelligencePipeline(
  input: DocumentIntelligenceInput,
  options: DocumentIntelligenceOptions = {}
): Promise<DocumentIntelligenceResult> {
  const { documentId, title, sourceType, extractedText, filePath } = input;
  const trimmed = extractedText.trim();

  if (!trimmed) {
    return {
      chunks: [],
      structure: {
        type: "title",
        title,
        content: "",
        level: 0,
        children: [],
        lineStart: 0,
        lineEnd: 0,
      },
      pages: [],
      entities: [],
      relationships: [],
      language: "en",
    };
  }

  console.log(
    `[documentIntelligence] Processing ${documentId} (${sourceType}): ${trimmed.length} chars`
  );

  // 1. Page extraction
  let pages: PageContent[] = [];

  if (options.preExtractedPages && options.preExtractedPages.length > 0) {
    pages = mapExtractionPagesToContent(options.preExtractedPages);
  } else if (sourceType === "pdf" && filePath) {
    const pageResult = await extractPdfPages(filePath);
    if (pageResult.success && pageResult.data) {
      pages = pageResult.data.pages;
    } else {
      pages = splitTextIntoEstimatedPages(trimmed);
    }
  } else {
    pages =
      trimmed.includes("\f")
        ? splitTextIntoEstimatedPages(trimmed)
        : [{ pageNumber: 1, text: trimmed, lineStart: 0, lineEnd: trimmed.split(/\r?\n/).length - 1 }];
  }

  // 2. Layout analysis
  const layoutBlocks = analyzeLayout(trimmed, pages);

  // 3. Document structure
  const structure = buildDocumentStructure(
    trimmed,
    title,
    layoutBlocks,
    pages
  );

  // 4. Semantic chunking
  let chunks = createSemanticChunks(structure, pages, {
    documentTitle: title,
    maxTokens: env.CHUNK_MAX_TOKENS,
  });

  // 5. Entity extraction
  chunks = extractEntitiesFromChunks(chunks);

  // 6. Relationship extraction
  chunks = extractRelationshipsFromChunks(chunks);

  const entities = aggregateDocumentEntities(chunks);
  const relationships = aggregateDocumentRelationships(chunks);
  const language = detectLanguage(trimmed);

  chunks = chunks.map((c) => ({ ...c, language }));

  console.log(
    `[documentIntelligence] ${documentId}: ${chunks.length} chunks, ${entities.length} entities, ${relationships.length} relationships, ${pages.length} pages`
  );

  return {
    chunks,
    structure,
    pages,
    entities,
    relationships,
    language,
  };
}

/** Check if Phase 5 document intelligence is enabled (any sub-feature) */
export function isDocumentIntelligenceEnabled(): boolean {
  return (
    env.ENABLE_LAYOUT_ANALYSIS ||
    env.ENABLE_ENTITY_EXTRACTION_INDEX ||
    env.ENABLE_RELATIONSHIP_EXTRACTION ||
    env.ENABLE_KNOWLEDGE_GRAPH ||
    env.ENABLE_TABLE_ANALYSIS ||
    env.ENABLE_IMAGE_ANALYSIS ||
    env.ENABLE_CODE_ANALYSIS
  );
}
