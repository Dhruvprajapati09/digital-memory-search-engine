import { env } from "../../config/env";
import { calculateTokens } from "../../utils/tokenCounter";
import type { RetrievedChunk } from "../../types/chat";
import { expandChunkContext } from "./contextExpansionService";
import { deduplicateExact } from "./duplicateDetectionService";
import {
  orderChunksLogically,
  groupChunksByDocument,
} from "./contextOrderingService";

export interface AssembledContext {
  chunks: RetrievedChunk[];
  estimatedTokens: number;
}

function estimateChunkTokens(chunk: RetrievedChunk): number {
  const headerTokens = calculateTokens(
    `[Source] ${chunk.metadata.documentTitle ?? ""} ${chunk.title ?? ""}`
  );
  return headerTokens + calculateTokens(chunk.text) + 8;
}

/**
 * Select chunks preserving logical continuity within token budget.
 * Prioritizes highest-scoring seed groups (document clusters).
 */
function selectWithContinuityBudget(
  chunks: RetrievedChunk[],
  seedChunks: RetrievedChunk[],
  maxTokens: number,
  maxChunks: number
): RetrievedChunk[] {
  const seedDocOrder: string[] = [];
  const seedDocSet = new Set<string>();

  for (const seed of [...seedChunks].sort((a, b) => b.score - a.score)) {
    const docId = seed.metadata.documentId;
    if (!seedDocSet.has(docId)) {
      seedDocSet.add(docId);
      seedDocOrder.push(docId);
    }
  }

  const groups = groupChunksByDocument(chunks);
  const selected: RetrievedChunk[] = [];
  const selectedKeys = new Set<string>();
  let usedTokens = 0;

  const tryAdd = (chunk: RetrievedChunk): boolean => {
    const key = `${chunk.metadata.documentId}:${chunk.metadata.chunkIndex}`;
    if (selectedKeys.has(key)) return false;
    if (selected.length >= maxChunks) return false;

    const tokens = estimateChunkTokens(chunk);
    if (selected.length > 0 && usedTokens + tokens > maxTokens) return false;

    selectedKeys.add(key);
    selected.push(chunk);
    usedTokens += tokens;
    return true;
  };

  // Add document groups in seed relevance order
  for (const docId of seedDocOrder) {
    const group = groups.get(docId);
    if (!group) continue;

    for (const chunk of group) {
      if (selected.length >= maxChunks) break;
      if (usedTokens >= maxTokens) break;
      tryAdd(chunk);
    }
  }

  // Fill remaining budget with other documents in logical order
  const remaining = orderChunksLogically(
    chunks.filter(
      (c) =>
        !selectedKeys.has(
          `${c.metadata.documentId}:${c.metadata.chunkIndex}`
        )
    )
  );

  for (const chunk of remaining) {
    if (selected.length >= maxChunks) break;
    tryAdd(chunk);
  }

  return orderChunksLogically(selected);
}

/**
 * Full context assembly pipeline (Phase 3):
 * expand → dedupe → order → token budget with continuity.
 */
export async function assembleContext(
  userId: string,
  seedChunks: RetrievedChunk[]
): Promise<AssembledContext> {
  if (seedChunks.length === 0) {
    return { chunks: [], estimatedTokens: 0 };
  }

  let chunks = seedChunks;

  if (env.ENABLE_CONTEXT_EXPANSION) {
    chunks = await expandChunkContext(userId, chunks);
  }

  if (env.ENABLE_DUPLICATE_REMOVAL) {
    const { removeDuplicateChunks } = await import(
      "./duplicateDetectionService"
    );
    chunks = removeDuplicateChunks(chunks);
  } else {
    chunks = deduplicateExact(chunks);
  }

  chunks = orderChunksLogically(chunks);

  const maxTokens = env.MAX_CONTEXT_TOKENS;
  const maxChunks = env.MAX_CONTEXT_CHUNKS;

  const budgeted = selectWithContinuityBudget(
    chunks,
    seedChunks,
    maxTokens,
    maxChunks
  );

  const text = budgeted.map((c) => c.text).join("\n");

  return {
    chunks: budgeted,
    estimatedTokens: calculateTokens(text),
  };
}
