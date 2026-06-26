import type { TopicChunk, TopicChunkingOptions } from "../../types/chunking";
import type { TranscriptSegment } from "../../types/youtube";
import { calculateTokens } from "../../utils/tokenCounter";
import { buildContentPreview } from "./chunkSplitter";
import { secondsToFormatted } from "../../utils/timestamp";

export interface TranscriptChunkMetadata {
  startSeconds: number;
  endSeconds: number;
  startTimeFormatted: string;
  endTimeFormatted: string;
  youtubeVideoId: string;
  channel: string;
  videoUrl: string;
}

export interface TimestampedTopicChunk extends TopicChunk {
  videoMetadata: TranscriptChunkMetadata;
}

/**
 * Chunk transcript segments using the existing token-budget approach.
 * Preserves start/end timestamps per chunk for video citations.
 */
export function chunkTranscriptByTopics(
  segments: TranscriptSegment[],
  options: TopicChunkingOptions & {
    youtubeVideoId: string;
    channel: string;
    videoUrl: string;
    videoTitle: string;
  }
): TimestampedTopicChunk[] {
  if (segments.length === 0) return [];

  const maxTokens = options.maxTokens ?? 512;
  const documentTitle = options.videoTitle ?? options.documentTitle ?? "Video";
  const chunks: TimestampedTopicChunk[] = [];
  let chunkIndex = 0;

  let buffer: TranscriptSegment[] = [];
  let bufferTokens = 0;

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const startSeconds = buffer[0].startSeconds;
    const endSeconds = buffer[buffer.length - 1].endSeconds;
    const startTimeFormatted = secondsToFormatted(startSeconds);
    const endTimeFormatted = secondsToFormatted(endSeconds);
    const text = buffer.map((s) => s.text).join(" ").trim();
    const title =
      startTimeFormatted === endTimeFormatted
        ? startTimeFormatted
        : `${startTimeFormatted} - ${endTimeFormatted}`;

    chunks.push({
      chunkIndex,
      text,
      title,
      topic: documentTitle,
      subtopic: startTimeFormatted,
      sectionPath: [documentTitle, startTimeFormatted],
      level: "semantic",
      tokenCount: calculateTokens(text),
      contentPreview: buildContentPreview(text),
      videoMetadata: {
        startSeconds,
        endSeconds,
        startTimeFormatted,
        endTimeFormatted,
        youtubeVideoId: options.youtubeVideoId,
        channel: options.channel,
        videoUrl: options.videoUrl,
      },
    });

    chunkIndex += 1;
    buffer = [];
    bufferTokens = 0;
  };

  for (const segment of segments) {
    const segmentTokens = calculateTokens(segment.text);

    if (
      buffer.length > 0 &&
      bufferTokens + segmentTokens > maxTokens
    ) {
      flushBuffer();
    }

    buffer.push(segment);
    bufferTokens += segmentTokens;

    if (bufferTokens >= maxTokens) {
      flushBuffer();
    }
  }

  flushBuffer();

  return chunks;
}
