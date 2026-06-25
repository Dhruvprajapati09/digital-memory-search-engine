import { calculateTokens } from "../../utils/tokenCounter";

const DEFAULT_MAX_TOKENS = 512;

/**
 * Split oversized text at paragraph → sentence boundaries.
 * Only splits when content exceeds the token limit.
 */
export function splitByTokenLimit(
  text: string,
  maxTokens = DEFAULT_MAX_TOKENS
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (calculateTokens(trimmed) <= maxTokens) {
    return [trimmed];
  }

  const paragraphs = trimmed.split(/\n{2,}/).filter(Boolean);
  const parts: string[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer.trim()) {
      parts.push(buffer.trim());
      buffer = "";
    }
  };

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;

    if (calculateTokens(candidate) <= maxTokens) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      flush();
    }

    if (calculateTokens(paragraph) <= maxTokens) {
      buffer = paragraph;
      continue;
    }

    // Split long paragraph by sentences
    const sentences = paragraph.match(/[^.!?]+[.!?]+|\S+/g) ?? [paragraph];
    let sentenceBuffer = "";

    for (const sentence of sentences) {
      const next = sentenceBuffer
        ? `${sentenceBuffer} ${sentence.trim()}`
        : sentence.trim();

      if (calculateTokens(next) <= maxTokens) {
        sentenceBuffer = next;
      } else {
        if (sentenceBuffer) parts.push(sentenceBuffer.trim());
        sentenceBuffer = sentence.trim();
      }
    }

    if (sentenceBuffer) {
      buffer = sentenceBuffer;
    }
  }

  flush();
  return parts.length > 0 ? parts : [trimmed];
}

export function buildContentPreview(text: string, maxLength = 200): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}
