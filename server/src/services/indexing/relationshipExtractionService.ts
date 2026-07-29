import { env } from "../../config/env";
import type {
  ExtractedEntity,
  ExtractedRelationship,
  SemanticChunk,
} from "../../types/documentIntelligence";

/** Known technology relationship patterns */
const USES_PATTERNS: Array<{ source: RegExp; target: RegExp; type: string }> = [
  {
    source: /\bReact\b/i,
    target: /\bNode\.js\b/i,
    type: "USES",
  },
  {
    source: /\bMongoDB\b/i,
    target: /\bExpress\b/i,
    type: "CONNECTS_TO",
  },
  {
    source: /\bExpress\b/i,
    target: /\bNode\.js\b/i,
    type: "BUILT_ON",
  },
  {
    source: /\bPinecone\b/i,
    target: /\b(?:vector|embedding|semantic)\b/i,
    type: "STORES",
  },
];

const WITH_PATTERNS = [
  /\b(\w[\w./-]*)\s+(?:with|using|via|through)\s+(\w[\w./-]*)/gi,
  /\b(\w[\w./-]*)\s+(?:connects?\s+to|integrates?\s+with)\s+(\w[\w./-]*)/gi,
];

function normalizeEntityName(name: string, entities: ExtractedEntity[]): string {
  const lower = name.trim().toLowerCase();
  const match = entities.find((e) => e.name.toLowerCase() === lower);
  return match?.name ?? name.trim();
}

/**
 * Extract entity relationships from chunk text (deterministic).
 */
export function extractRelationshipsFromText(
  text: string,
  entities: ExtractedEntity[] = []
): ExtractedRelationship[] {
  if (!env.ENABLE_RELATIONSHIP_EXTRACTION) return [];

  const found = new Map<string, ExtractedRelationship>();

  for (const pattern of USES_PATTERNS) {
    if (pattern.source.test(text) && pattern.target.test(text)) {
      const sourceMatch = text.match(pattern.source)?.[0];
      const targetMatch = text.match(pattern.target)?.[0];
      if (sourceMatch && targetMatch) {
        const rel: ExtractedRelationship = {
          source: normalizeEntityName(sourceMatch, entities),
          target: normalizeEntityName(targetMatch, entities),
          type: pattern.type,
        };
        found.set(`${rel.source}|${rel.type}|${rel.target}`, rel);
      }
    }
  }

  for (const regex of WITH_PATTERNS) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const source = normalizeEntityName(match[1], entities);
      const target = normalizeEntityName(match[2], entities);

      if (source.length >= 2 && target.length >= 2 && source !== target) {
        const rel: ExtractedRelationship = {
          source,
          target,
          type: "USES",
        };
        found.set(`${rel.source}|${rel.type}|${rel.target}`, rel);
      }
    }
  }

  // Co-occurrence relationships between known entities in same chunk
  if (entities.length >= 2) {
    for (let i = 0; i < entities.length; i += 1) {
      for (let j = i + 1; j < entities.length; j += 1) {
        const rel: ExtractedRelationship = {
          source: entities[i].name,
          target: entities[j].name,
          type: "RELATED_TO",
        };
        found.set(`${rel.source}|${rel.type}|${rel.target}`, rel);
      }
    }
  }

  return [...found.values()];
}

/** Extract relationships for all chunks */
export function extractRelationshipsFromChunks(
  chunks: SemanticChunk[]
): SemanticChunk[] {
  if (!env.ENABLE_RELATIONSHIP_EXTRACTION) return chunks;

  return chunks.map((chunk) => ({
    ...chunk,
    relationships: extractRelationshipsFromText(
      chunk.text,
      chunk.entities ?? []
    ),
  }));
}

/** Aggregate unique relationships across document */
export function aggregateDocumentRelationships(
  chunks: SemanticChunk[]
): ExtractedRelationship[] {
  const found = new Map<string, ExtractedRelationship>();

  for (const chunk of chunks) {
    for (const rel of chunk.relationships ?? []) {
      found.set(`${rel.source}|${rel.type}|${rel.target}`, rel);
    }
  }

  return [...found.values()];
}
