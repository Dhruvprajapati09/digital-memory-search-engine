import { env } from "../../config/env";
import { calculateTokens } from "../../utils/tokenCounter";
import { buildYoutubeWatchUrl } from "../../utils/timestamp";
import type { AiChunkDetail, AiSource, BuiltContext } from "../../types/ai";
import type { RetrievedChunk } from "../../types/chat";

const CONTEXT_SEPARATOR = "\n\n---\n\n";

/**
 * Extract optional page number from chunk metadata when available.
 */
function resolvePageNumber(chunk: RetrievedChunk): number | undefined {
  const raw = chunk.metadata.page ?? chunk.metadata.pageNumber;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return undefined;
}

function isVideoChunk(chunk: RetrievedChunk): boolean {
  return (
    chunk.metadata.type === "video" ||
    chunk.metadata.sourceType === "video" ||
    Boolean(chunk.metadata.youtubeVideoId)
  );
}

function resolveVideoTimestamp(chunk: RetrievedChunk): {
  formatted?: string;
  seconds?: number;
  url?: string;
} {
  const seconds =
    (chunk.metadata.timestampSeconds as number | undefined) ??
    (chunk.metadata.startSeconds as number | undefined);

  const formatted =
    (chunk.metadata.timestampFormatted as string | undefined) ??
    (chunk.metadata.startTimeFormatted as string | undefined);

  const youtubeVideoId = chunk.metadata.youtubeVideoId as string | undefined;
  const videoUrl =
    (chunk.metadata.videoUrl as string | undefined) ??
    (youtubeVideoId
      ? buildYoutubeWatchUrl(
          youtubeVideoId,
          typeof seconds === "number" ? seconds : undefined
        )
      : undefined);

  return {
    formatted,
    seconds: typeof seconds === "number" ? Math.floor(seconds) : undefined,
    url: videoUrl,
  };
}

/**
 * Remove duplicate chunks (same vectorId or same document+chunkIndex).
 * Keeps the highest-scoring instance.
 */
export function deduplicateChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const byKey = new Map<string, RetrievedChunk>();

  for (const chunk of chunks) {
    const key = `${chunk.metadata.documentId}:${chunk.metadata.chunkIndex}`;
    const existing = byKey.get(key);

    if (!existing || chunk.score > existing.score) {
      byKey.set(key, chunk);
    }
  }

  return Array.from(byKey.values());
}

/**
 * Sort chunks by relevance (similarity score descending).
 */
export function sortChunksByRelevance(
  chunks: RetrievedChunk[]
): RetrievedChunk[] {
  return [...chunks].sort((a, b) => b.score - a.score);
}

/**
 * Limit chunks to fit within the configured context token budget.
 */
export function limitChunksByTokenBudget(
  chunks: RetrievedChunk[],
  maxTokens: number = env.MAX_CONTEXT_TOKENS
): RetrievedChunk[] {
  const selected: RetrievedChunk[] = [];
  let usedTokens = 0;

  for (const chunk of chunks) {
    const headerTokens = calculateTokens(
      `[Source] ${chunk.metadata.documentTitle ?? ""} ${chunk.title ?? ""}`
    );
    const bodyTokens = calculateTokens(chunk.text);
    const chunkTokens = headerTokens + bodyTokens + 8;

    if (selected.length > 0 && usedTokens + chunkTokens > maxTokens) {
      break;
    }

    selected.push(chunk);
    usedTokens += chunkTokens;
  }

  return selected;
}

/**
 * Format a single chunk into a context block with preserved metadata.
 */
function formatChunkBlock(chunk: RetrievedChunk, index: number): string {
  const isVideo = isVideoChunk(chunk);
  const videoTs = isVideo ? resolveVideoTimestamp(chunk) : undefined;

  const header = [
    `[Source ${index + 1}]`,
    isVideo ? "Type: Video" : null,
    chunk.metadata.documentTitle
      ? `${isVideo ? "Video" : "Document"}: ${chunk.metadata.documentTitle}`
      : null,
    isVideo && chunk.metadata.channel
      ? `Channel: ${chunk.metadata.channel}`
      : null,
    chunk.title ? `Section: ${chunk.title}` : null,
    chunk.topic ? `Topic: ${chunk.topic}` : null,
    chunk.subtopic ? `Subtopic: ${chunk.subtopic}` : null,
    !isVideo && resolvePageNumber(chunk) !== undefined
      ? `Page: ${resolvePageNumber(chunk)}`
      : null,
    isVideo && videoTs?.formatted
      ? `Timestamp: ${videoTs.formatted}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return `${header}\n${chunk.text}`;
}

/**
 * Build a token-bounded context window from retrieved chunks.
 */
export function buildContext(chunks: RetrievedChunk[]): BuiltContext {
  const processed = limitChunksByTokenBudget(
    sortChunksByRelevance(deduplicateChunks(chunks))
  );

  const text = processed
    .map((chunk, index) => formatChunkBlock(chunk, index))
    .join(CONTEXT_SEPARATOR);

  return {
    text,
    chunks: processed,
    estimatedTokens: calculateTokens(text),
  };
}

/**
 * Map retrieved chunks to API source citations.
 */
export function buildSourcesFromChunks(chunks: RetrievedChunk[]): AiSource[] {
  return chunks.map((chunk) => {
    const isVideo = isVideoChunk(chunk);
    const videoTs = isVideo ? resolveVideoTimestamp(chunk) : undefined;

    return {
      documentId: chunk.metadata.documentId,
      documentName: chunk.metadata.documentTitle ?? "Untitled",
      type: isVideo ? "video" : "document",
      page: isVideo ? undefined : resolvePageNumber(chunk),
      chunkId: chunk.vectorId,
      chunkIndex: chunk.metadata.chunkIndex,
      score: Math.round(chunk.score * 100) / 100,
      highlightedText: chunk.contentPreview ?? chunk.text.slice(0, 300),
      topic: chunk.topic,
      title: chunk.title,
      channel: chunk.metadata.channel as string | undefined,
      timestamp: videoTs?.formatted,
      timestampSeconds: videoTs?.seconds,
      videoUrl: videoTs?.url,
      youtubeVideoId: chunk.metadata.youtubeVideoId as string | undefined,
    };
  });
}

/**
 * Map retrieved chunks to detailed chunk objects for the source viewer.
 */
export function buildChunkDetails(chunks: RetrievedChunk[]): AiChunkDetail[] {
  return chunks.map((chunk) => {
    const isVideo = isVideoChunk(chunk);
    const videoTs = isVideo ? resolveVideoTimestamp(chunk) : undefined;

    return {
      chunkId: chunk.vectorId,
      chunkIndex: chunk.metadata.chunkIndex,
      documentId: chunk.metadata.documentId,
      documentName: chunk.metadata.documentTitle ?? "Untitled",
      type: isVideo ? "video" : "document",
      score: Math.round(chunk.score * 100) / 100,
      text: chunk.text,
      topic: chunk.topic,
      title: chunk.title,
      page: isVideo ? undefined : resolvePageNumber(chunk),
      channel: chunk.metadata.channel as string | undefined,
      timestamp: videoTs?.formatted,
      timestampSeconds: videoTs?.seconds,
      videoUrl: videoTs?.url,
      youtubeVideoId: chunk.metadata.youtubeVideoId as string | undefined,
    };
  });
}
