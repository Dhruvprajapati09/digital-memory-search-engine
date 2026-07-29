import { env } from "../../config/env";
import ChunkModel from "../../models/Chunk";
import type {
  IndexValidationIssue,
  IndexValidationReport,
} from "../../types/documentIntelligence";

/**
 * Validate document index integrity and return a detailed report.
 */
export async function validateDocumentIndex(
  documentId: string,
  userId: string
): Promise<IndexValidationReport> {
  const issues: IndexValidationIssue[] = [];
  const checkedAt = new Date();

  if (!env.ENABLE_INDEX_VALIDATION) {
    const chunkCount = await ChunkModel.countDocuments({ documentId, userId });
    return {
      documentId,
      valid: true,
      issues: [],
      chunkCount,
      checkedAt,
    };
  }

  const chunks = await ChunkModel.find({ documentId, userId })
    .sort({ chunkIndex: 1 })
    .lean();

  const chunkCount = chunks.length;

  if (chunkCount === 0) {
    return {
      documentId,
      valid: false,
      issues: [
        {
          type: "missing_embedding",
          message: "Document has no indexed chunks",
          severity: "error",
        },
      ],
      chunkCount: 0,
      checkedAt,
    };
  }

  const indexSet = new Set<number>();
  const hashSet = new Map<string, number>();
  const idByIndex = new Map<number, string>();

  for (const chunk of chunks) {
    idByIndex.set(chunk.chunkIndex, chunk._id.toString());

    if (!chunk.vectorId || chunk.vectorId === "pending") {
      issues.push({
        type: "missing_embedding",
        chunkIndex: chunk.chunkIndex,
        vectorId: chunk.vectorId,
        message: `Chunk ${chunk.chunkIndex} has no valid vector ID`,
        severity: "error",
      });
    }

    if (!chunk.text?.trim()) {
      issues.push({
        type: "missing_metadata",
        chunkIndex: chunk.chunkIndex,
        message: `Chunk ${chunk.chunkIndex} has empty text`,
        severity: "error",
      });
    }

    if (!chunk.topic || !chunk.title) {
      issues.push({
        type: "missing_metadata",
        chunkIndex: chunk.chunkIndex,
        message: `Chunk ${chunk.chunkIndex} missing topic or title`,
        severity: "warning",
      });
    }

    if (!chunk.chunkHash) {
      issues.push({
        type: "missing_metadata",
        chunkIndex: chunk.chunkIndex,
        message: `Chunk ${chunk.chunkIndex} missing chunkHash`,
        severity: "warning",
      });
    }

    if (!chunk.embeddingVersion) {
      issues.push({
        type: "missing_metadata",
        chunkIndex: chunk.chunkIndex,
        message: `Chunk ${chunk.chunkIndex} missing embeddingVersion`,
        severity: "warning",
      });
    }

    if (indexSet.has(chunk.chunkIndex)) {
      issues.push({
        type: "duplicate_chunk",
        chunkIndex: chunk.chunkIndex,
        message: `Duplicate chunkIndex ${chunk.chunkIndex}`,
        severity: "error",
      });
    }
    indexSet.add(chunk.chunkIndex);

    if (chunk.chunkHash) {
      const existing = hashSet.get(chunk.chunkHash);
      if (existing !== undefined && existing !== chunk.chunkIndex) {
        issues.push({
          type: "duplicate_chunk",
          chunkIndex: chunk.chunkIndex,
          message: `Chunk ${chunk.chunkIndex} duplicates hash of chunk ${existing}`,
          severity: "warning",
        });
      }
      hashSet.set(chunk.chunkHash, chunk.chunkIndex);
    }

    if (chunk.parentChunkIndex !== undefined) {
      if (!indexSet.has(chunk.parentChunkIndex) && chunk.parentChunkIndex >= 0) {
        const parentExists = chunks.some(
          (c) => c.chunkIndex === chunk.parentChunkIndex
        );
        if (!parentExists) {
          issues.push({
            type: "broken_hierarchy",
            chunkIndex: chunk.chunkIndex,
            message: `Chunk ${chunk.chunkIndex} references missing parent ${chunk.parentChunkIndex}`,
            severity: "error",
          });
        }
      }
    }
  }

  // Orphan detection: parentChunkId without matching parent
  for (const chunk of chunks) {
    if (chunk.parentChunkId) {
      const parentExists = chunks.some(
        (c) => c._id.toString() === chunk.parentChunkId?.toString()
      );
      if (!parentExists) {
        issues.push({
          type: "orphan_chunk",
          chunkIndex: chunk.chunkIndex,
          message: `Chunk ${chunk.chunkIndex} has orphan parentChunkId`,
          severity: "error",
        });
      }
    }
  }

  // Relationship validation
  for (const chunk of chunks) {
    for (const rel of chunk.relationships ?? []) {
      if (!rel.source || !rel.target || !rel.type) {
        issues.push({
          type: "relationship_issue",
          chunkIndex: chunk.chunkIndex,
          message: `Chunk ${chunk.chunkIndex} has incomplete relationship`,
          severity: "warning",
        });
      }
      if (rel.source === rel.target) {
        issues.push({
          type: "relationship_issue",
          chunkIndex: chunk.chunkIndex,
          message: `Chunk ${chunk.chunkIndex} has self-referencing relationship`,
          severity: "warning",
        });
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    documentId,
    valid: !hasErrors,
    issues,
    chunkCount,
    checkedAt,
  };
}
