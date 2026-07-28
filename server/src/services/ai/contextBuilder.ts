import { env } from "../../config/env";
import { calculateTokens } from "../../utils/tokenCounter";
import { buildYoutubeWatchUrl } from "../../utils/timestamp";
import type { AiChunkDetail, AiSource, BuiltContext } from "../../types/ai";
import type { RetrievedChunk } from "../../types/chat";
import { assembleContext } from "../context/contextAssembler";

const CONTEXT_SEPARATOR = "\n\n---\n\n";

function resolvePageNumber(chunk: RetrievedChunk): number | undefined {
  const raw = chunk.metadata.pageNumber ?? chunk.metadata.page;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return undefined;
}

function resolveChapter(chunk: RetrievedChunk): string | undefined {
  const chapter = chunk.metadata.chapter as string | undefined;
  if (chapter) return chapter;
  const path = chunk.sectionPath ?? [];
  return path.length > 0 ? path[0] : undefined;
}

function resolveSection(chunk: RetrievedChunk): string | undefined {
  const section = chunk.metadata.section as string | undefined;
  if (section) return section;
  const path = chunk.sectionPath ?? [];
  if (path.length >= 2) return path[path.length - 1];
  return chunk.title;
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

function resolveConfidenceScore(chunk: RetrievedChunk): number | undefined {
  const raw =
    chunk.metadata.confidenceScore ?? chunk.metadata.retrievalScore;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(raw * 100) / 100;
  }
  return Math.round(chunk.score * 100) / 100;
}

function resolveSourceType(chunk: RetrievedChunk): string {
  if (isVideoChunk(chunk)) return "video";
  return (chunk.metadata.sourceType as string) ?? chunk.metadata.type ?? "document";
}

/**
 * Format a single chunk into a context block with full metadata (Phase 3).
 */
export function formatChunkBlock(chunk: RetrievedChunk, index: number): string {
  const isVideo = isVideoChunk(chunk);
  const videoTs = isVideo ? resolveVideoTimestamp(chunk) : undefined;
  const confidence = resolveConfidenceScore(chunk);

  const header = [
    `[Source ${index + 1}]`,
    `Chunk ID: ${chunk.vectorId}`,
    `Source Type: ${resolveSourceType(chunk)}`,
    chunk.metadata.documentTitle
      ? `${isVideo ? "Video" : "Document"}: ${chunk.metadata.documentTitle}`
      : null,
    isVideo && chunk.metadata.channel
      ? `Channel: ${chunk.metadata.channel}`
      : null,
    resolveChapter(chunk) ? `Chapter: ${resolveChapter(chunk)}` : null,
    resolveSection(chunk) ? `Section: ${resolveSection(chunk)}` : null,
    chunk.title && chunk.title !== resolveSection(chunk)
      ? `Heading: ${chunk.title}`
      : null,
    chunk.topic ? `Topic: ${chunk.topic}` : null,
    chunk.subtopic ? `Subtopic: ${chunk.subtopic}` : null,
    !isVideo && resolvePageNumber(chunk) !== undefined
      ? `Page: ${resolvePageNumber(chunk)}`
      : null,
    isVideo && videoTs?.formatted
      ? `Timestamp: ${videoTs.formatted}`
      : null,
    `Score: ${Math.round(chunk.score * 100) / 100}`,
    confidence !== undefined ? `Confidence: ${confidence}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return `${header}\n${chunk.text}`;
}

/** Format assembled chunks into LLM context text */
export function formatContextText(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) => formatChunkBlock(chunk, index))
    .join(CONTEXT_SEPARATOR);
}

/**
 * @deprecated Use deduplicate from duplicateDetectionService — kept for compatibility
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

/** @deprecated Context ordering handled by contextAssembler */
export function sortChunksByRelevance(
  chunks: RetrievedChunk[]
): RetrievedChunk[] {
  return [...chunks].sort((a, b) => b.score - a.score);
}

/** @deprecated Token budget handled by contextAssembler */
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
 * Build a token-bounded, logically ordered context window (Phase 3 pipeline).
 */
export async function buildContext(
  userId: string,
  chunks: RetrievedChunk[]
): Promise<BuiltContext> {
  const assembled = await assembleContext(userId, chunks);
  const text = formatContextText(assembled.chunks);

  return {
    text,
    chunks: assembled.chunks,
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
