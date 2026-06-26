export type VideoStatus =
  | "pending"
  | "processing"
  | "indexed"
  | "failed"
  | "no_transcript";

export interface YouTubeImportRequest {
  url: string;
}

export interface YouTubeVideoSummary {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  language?: string;
  url: string;
  status: VideoStatus;
  documentId?: string;
  chunksIndexed?: number;
}

export interface YouTubeImportResponse {
  success: boolean;
  video: YouTubeVideoSummary;
  chunksIndexed: number;
  /** True when an existing indexed video was returned */
  duplicate?: boolean;
}

export interface TranscriptSegment {
  text: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
}

export interface CleanedTranscript {
  segments: TranscriptSegment[];
  fullText: string;
  language?: string;
}

export interface VideoMetadata {
  videoId: string;
  title: string;
  channel: string;
  description: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string;
  publishedAt?: string;
  language?: string;
  url: string;
}

export interface ParsedYouTubeUrl {
  videoId: string;
  normalizedUrl: string;
}
