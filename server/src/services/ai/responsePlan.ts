/**
 * Query understanding for answer style (not retrieval).
 * Rule-based, multi-label: styles + length + format.
 * Cue lists live in answerStyleConfig (shared with RAG cleanup).
 */

import {
  cueToPattern,
  FORMAT_CUE_GROUPS,
  LENGTH_CUE_GROUPS,
  STYLE_CUE_GROUPS,
  type ResponseFormat,
  type ResponseLength,
  type ResponseStyle,
} from "./answerStyleConfig";

export type { ResponseFormat, ResponseLength, ResponseStyle };

export interface ResponsePlan {
  /** One or more styles, ordered by STYLE_PRIORITY */
  styles: ResponseStyle[];
  length: ResponseLength;
  format: ResponseFormat;
}

export const DEFAULT_RESPONSE_PLAN: ResponsePlan = {
  styles: ["explanation"],
  length: "normal",
  format: "paragraph",
};

/** Deterministic order for composed prompt blocks */
const STYLE_PRIORITY: ResponseStyle[] = [
  "comparison",
  "definition",
  "procedure",
  "summary",
  "list",
  "example",
  "explanation",
  "simple",
];

interface StylePatternGroup {
  style: ResponseStyle;
  patterns: RegExp[];
}

function buildStylePatterns(): StylePatternGroup[] {
  return STYLE_CUE_GROUPS.map((group) => ({
    style: group.style,
    patterns: [
      ...group.phrases.map(cueToPattern),
      ...group.tokens.map(cueToPattern),
      ...(group.extraPatterns ?? []),
    ],
  }));
}

const STYLE_PATTERNS = buildStylePatterns();

const SHORT_PATTERNS = LENGTH_CUE_GROUPS.filter((g) => g.length === "short").flatMap(
  (g) => [
    ...g.phrases.map(cueToPattern),
    ...g.tokens.map(cueToPattern),
    /\btl;dr\b/,
  ]
);

const DETAILED_PATTERNS = LENGTH_CUE_GROUPS.filter(
  (g) => g.length === "detailed"
).flatMap((g) => [
  ...g.phrases.map(cueToPattern),
  ...g.tokens.map(cueToPattern),
]);

const FORMAT_PATTERNS = FORMAT_CUE_GROUPS.map((group) => ({
  format: group.format,
  patterns: [
    ...group.phrases.map(cueToPattern),
    ...group.tokens.map(cueToPattern),
  ],
}));

const EXPLICIT_FORMAT_PRIORITY: ResponseFormat[] = [
  "table",
  "steps",
  "list",
  "paragraph",
];

function anyMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function detectStyles(normalized: string): ResponseStyle[] {
  const matched = new Set<ResponseStyle>();

  for (const { style, patterns } of STYLE_PATTERNS) {
    if (anyMatch(normalized, patterns)) {
      matched.add(style);
    }
  }

  if (matched.size === 0) {
    return ["explanation"];
  }

  // "simple" alone modifies an explanation
  if (matched.has("simple") && matched.size === 1) {
    matched.add("explanation");
  }

  return STYLE_PRIORITY.filter((s) => matched.has(s));
}

function detectLength(normalized: string): ResponseLength {
  const wantsDetailed = anyMatch(normalized, DETAILED_PATTERNS);
  const wantsShort = anyMatch(normalized, SHORT_PATTERNS);

  if (wantsDetailed) return "detailed";
  if (wantsShort) return "short";
  return "normal";
}

function detectFormat(
  normalized: string,
  styles: ResponseStyle[]
): ResponseFormat {
  const explicit = new Set<ResponseFormat>();

  for (const { format, patterns } of FORMAT_PATTERNS) {
    if (anyMatch(normalized, patterns)) {
      explicit.add(format);
    }
  }

  if (explicit.size > 0) {
    for (const format of EXPLICIT_FORMAT_PRIORITY) {
      if (explicit.has(format)) return format;
    }
  }

  if (styles.includes("comparison")) return "table";
  if (styles.includes("procedure")) return "steps";
  if (styles.includes("list")) return "list";

  return "paragraph";
}

/**
 * Detect how the user wants the answer presented (styles, length, format).
 * Does not affect retrieval.
 */
export function detectResponsePlan(question: string): ResponsePlan {
  const normalized = question.trim().toLowerCase();

  if (!normalized) {
    return {
      ...DEFAULT_RESPONSE_PLAN,
      styles: [...DEFAULT_RESPONSE_PLAN.styles],
    };
  }

  const styles = detectStyles(normalized);
  const length = detectLength(normalized);
  const format = detectFormat(normalized, styles);

  return { styles, length, format };
}
