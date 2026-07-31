import { calculateTokens } from "../../utils/tokenCounter";

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_MIN_TOKENS = 24;
const DEFAULT_OVERLAP_RATIO = 0.12;
const MAX_OVERLAP_TOKENS = 80;

type LogicalBlockType = "paragraph" | "list" | "table" | "code";

export interface LogicalBlock {
  type: LogicalBlockType;
  text: string;
}

interface SplitOptions {
  minTokens?: number;
  overlapRatio?: number;
}

const LIST_LINE = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/;
const TABLE_LINE = /^\s*\|.+\|\s*$/;
const CODE_FENCE = /^\s*```/;

function isListLine(line: string): boolean {
  return LIST_LINE.test(line);
}

function isTableLine(line: string): boolean {
  return TABLE_LINE.test(line);
}

function splitSentences(text: string): string[] {
  return (
    text.match(/[^.!?]+(?:[.!?]+["')\]]?|\s*$)/g) ?? [text]
  )
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function detectBlockType(lines: string[]): LogicalBlockType {
  if (lines.some((line) => CODE_FENCE.test(line))) return "code";
  if (lines.every((line) => isTableLine(line.trim()))) return "table";
  if (lines.every((line) => isListLine(line) || /^\s{2,}\S/.test(line))) {
    return "list";
  }
  return "paragraph";
}

/**
 * Break text into logical blocks so bullets, tables, and code examples stay
 * together during chunk assembly.
 */
export function parseLogicalBlocks(text: string): LogicalBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: LogicalBlock[] = [];
  let buffer: string[] = [];
  let inCode = false;

  const flush = () => {
    const blockText = buffer.join("\n").trim();
    if (blockText) {
      blocks.push({ type: detectBlockType(buffer), text: blockText });
    }
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (CODE_FENCE.test(trimmed)) {
      if (!inCode && buffer.length > 0) flush();
      buffer.push(line);
      inCode = !inCode;
      if (!inCode) flush();
      continue;
    }

    if (inCode) {
      buffer.push(line);
      continue;
    }

    if (!trimmed) {
      flush();
      continue;
    }

    const currentType = buffer.length > 0 ? detectBlockType(buffer) : undefined;
    const nextType: LogicalBlockType = isTableLine(trimmed)
      ? "table"
      : isListLine(line) || /^\s{2,}\S/.test(line)
        ? "list"
        : "paragraph";

    if (
      buffer.length > 0 &&
      currentType !== nextType &&
      currentType !== "list"
    ) {
      flush();
    }

    buffer.push(line);
  }

  flush();
  return blocks;
}

function addContextOverlap(
  previous: string | undefined,
  current: string,
  maxTokens: number,
  overlapRatio: number
): string {
  if (!previous) return current;

  const overlapTokenBudget = Math.min(
    MAX_OVERLAP_TOKENS,
    Math.max(0, Math.floor(maxTokens * overlapRatio))
  );

  if (overlapTokenBudget <= 0) return current;

  const previousBlocks = parseLogicalBlocks(previous);
  const overlapCandidates =
    previousBlocks.length > 0
      ? previousBlocks.map((block) => block.text).reverse()
      : splitSentences(previous).reverse();

  let overlap = "";

  for (const candidate of overlapCandidates) {
    const next = overlap ? `${candidate}\n\n${overlap}` : candidate;
    if (calculateTokens(next) > overlapTokenBudget) break;
    overlap = next;
  }

  if (!overlap) return current;

  const withOverlap = `${overlap}\n\n${current}`.trim();
  return calculateTokens(withOverlap) <= maxTokens ? withOverlap : current;
}

function isReadableChunk(text: string, minTokens: number): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (calculateTokens(normalized) < minTokens && normalized.split(/\s+/).length < 6) {
    return false;
  }
  return /[A-Za-z0-9]/.test(normalized);
}

function splitOversizedBlock(block: LogicalBlock, maxTokens: number): string[] {
  if (calculateTokens(block.text) <= maxTokens) {
    return [block.text];
  }

  if (block.type === "code" || block.type === "table" || block.type === "list") {
    const lines = block.text.split(/\r?\n/).filter((line) => line.trim());
    const parts: string[] = [];
    let buffer = "";

    for (const line of lines) {
      const next = buffer ? `${buffer}\n${line}` : line;
      if (calculateTokens(next) <= maxTokens || !buffer) {
        buffer = next;
      } else {
        parts.push(buffer.trim());
        buffer = line;
      }
    }

    if (buffer.trim()) parts.push(buffer.trim());
    return parts;
  }

  const sentences = splitSentences(block.text);
  const parts: string[] = [];
  let buffer = "";

  for (const sentence of sentences) {
    const next = buffer ? `${buffer} ${sentence}` : sentence;
    if (calculateTokens(next) <= maxTokens || !buffer) {
      buffer = next;
    } else {
      parts.push(buffer.trim());
      buffer = sentence;
    }
  }

  if (buffer.trim()) parts.push(buffer.trim());
  return parts.length > 0 ? parts : [block.text];
}

/**
 * Split oversized text at logical boundaries: paragraphs, list/table/code
 * blocks, then sentences. This avoids fixed-size slicing and keeps each chunk
 * focused while carrying a small overlap from the previous chunk.
 */
export function splitByTokenLimit(
  text: string,
  maxTokens = DEFAULT_MAX_TOKENS,
  options: SplitOptions = {}
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (calculateTokens(trimmed) <= maxTokens) {
    return [trimmed];
  }

  const minTokens = options.minTokens ?? DEFAULT_MIN_TOKENS;
  const overlapRatio = options.overlapRatio ?? DEFAULT_OVERLAP_RATIO;
  const blocks = parseLogicalBlocks(trimmed);
  const parts: string[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer.trim()) {
      parts.push(buffer.trim());
      buffer = "";
    }
  };

  for (const block of blocks) {
    const blockParts = splitOversizedBlock(block, maxTokens);

    for (const blockPart of blockParts) {
      const candidate = buffer ? `${buffer}\n\n${blockPart}` : blockPart;

      if (calculateTokens(candidate) <= maxTokens) {
        buffer = candidate;
        continue;
      }

      if (buffer) flush();
      buffer = blockPart;
    }
  }

  flush();

  const qualityParts = parts.filter((part, index) => {
    if (isReadableChunk(part, minTokens)) return true;
    if (index > 0 && parts[index - 1]) {
      parts[index - 1] = `${parts[index - 1]}\n\n${part}`.trim();
    }
    return false;
  });

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const part of qualityParts.length > 0 ? qualityParts : parts) {
    const signature = part.toLowerCase().replace(/\W+/g, " ").trim();
    if (!signature || seen.has(signature)) continue;

    const withOverlap = addContextOverlap(
      deduped[deduped.length - 1],
      part,
      maxTokens,
      overlapRatio
    );
    deduped.push(withOverlap);
    seen.add(signature);
  }

  return deduped.length > 0 ? deduped : [trimmed];
}

export function buildContentPreview(text: string, maxLength = 200): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength - 3);
  const lastSpace = clipped.lastIndexOf(" ");
  const safeClip = lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped;
  return `${safeClip.trim()}...`;
}
