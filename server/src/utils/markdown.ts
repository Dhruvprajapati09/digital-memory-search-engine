import type { AiSource } from "../types/ai";

/**
 * Format a similarity score as a human-readable percentage string.
 */
export function formatSimilarityPercent(score: number): string {
  const pct = Math.round(Math.min(Math.max(score, 0), 1) * 100);
  return `${pct}%`;
}

/**
 * Build a markdown sources section appended to AI answers when needed.
 */
export function formatSourcesMarkdown(sources: AiSource[]): string {
  if (sources.length === 0) return "";

  const lines = sources.map((source, index) => {
    const isVideo = source.type === "video";
    const locationPart = isVideo
      ? source.timestamp
        ? ` · ${source.timestamp}`
        : ""
      : source.page !== undefined
        ? ` · Page ${source.page}`
        : "";
    const similarity = formatSimilarityPercent(source.score);

    return [
      `${index + 1}. **${isVideo ? "📺 " : ""}${source.documentName}**${locationPart}`,
      isVideo && source.channel ? `   - Channel: ${source.channel}` : null,
      `   - Similarity: ${similarity}`,
      isVideo && source.videoUrl ? `   - Link: ${source.videoUrl}` : null,
      `   - Chunk: ${source.chunkIndex + 1} (\`${source.chunkId.slice(0, 8)}…\`)`,
      source.title ? `   - Section: ${source.title}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `\n\n---\n\n### Sources\n\n${lines.join("\n\n")}`;
}

/**
 * Strip control characters and collapse excessive whitespace from user input.
 */
export function sanitizeUserInput(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
