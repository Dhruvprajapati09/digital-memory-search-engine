/**
 * Shared answer-style cues for ResponsePlan detection and RAG retrieval cleanup.
 * Add new instruction phrases/tokens here so both stay in sync.
 */

export type ResponseStyle =
  | "definition"
  | "explanation"
  | "simple"
  | "example"
  | "comparison"
  | "summary"
  | "list"
  | "procedure";

export type ResponseLength = "short" | "normal" | "detailed";
export type ResponseFormat = "paragraph" | "list" | "table" | "steps";

export interface StyleCueGroup {
  style: ResponseStyle;
  /** Multi-word cues (stripped from retrieval; used for detection) */
  phrases: readonly string[];
  /** Single-word cues */
  tokens: readonly string[];
  /** Regex-only cues that cannot be expressed as plain phrases */
  extraPatterns?: readonly RegExp[];
}

export interface LengthCueGroup {
  length: Exclude<ResponseLength, "normal">;
  phrases: readonly string[];
  tokens: readonly string[];
}

export interface FormatCueGroup {
  format: Exclude<ResponseFormat, "paragraph">;
  phrases: readonly string[];
  tokens: readonly string[];
}

export const STYLE_CUE_GROUPS: readonly StyleCueGroup[] = [
  {
    style: "simple",
    phrases: [
      "in simple language",
      "for a beginner",
      "plain english",
      "in plain terms",
      "in laymans terms",
      "in layman's terms",
    ],
    tokens: ["simply", "eli5", "simple", "language"],
    extraPatterns: [/\blike i'?m 5\b/],
  },
  {
    style: "comparison",
    phrases: [
      "difference between",
      "differences between",
      "better than",
    ],
    tokens: ["compare", "comparison", "versus", "vs"],
    extraPatterns: [/\bvs\.?\b/],
  },
  {
    style: "example",
    phrases: [
      "give an example",
      "give an examples",
      "give me an example",
      "give me an examples",
      "examples of",
      "example of",
      "for instance",
      "sample of",
      "show an example",
      "show me an example",
      "with an example",
      "with examples",
    ],
    tokens: ["example", "examples", "sample", "demo"],
  },
  {
    style: "definition",
    phrases: ["definition of", "meaning of"],
    tokens: ["define"],
  },
  {
    style: "summary",
    phrases: [
      "summary of",
      "in short",
      "key points",
      "overview of",
    ],
    tokens: ["summarize", "summarise", "summary", "tldr", "overview"],
    extraPatterns: [/\btl;dr\b/],
  },
  {
    style: "list",
    phrases: ["benefits of"],
    tokens: [
      "list",
      "advantages",
      "advantage",
      "disadvantages",
      "disadvantage",
      "pros",
      "cons",
      "drawbacks",
      "drawback",
      "applications",
      "application",
    ],
  },
  {
    style: "procedure",
    phrases: [
      "how does",
      "how do",
      "how to",
      "step by step",
      "walk me through",
    ],
    tokens: ["walkthrough"],
  },
  {
    style: "explanation",
    phrases: ["what is", "what are"],
    tokens: ["explain", "describe"],
  },
];

export const LENGTH_CUE_GROUPS: readonly LengthCueGroup[] = [
  {
    length: "short",
    phrases: ["in brief", "one sentence"],
    tokens: ["briefly", "brief", "short", "concise", "tldr", "quick"],
  },
  {
    length: "detailed",
    phrases: ["in detail", "deep dive"],
    tokens: [
      "detailed",
      "thoroughly",
      "comprehensive",
      "elaborate",
    ],
  },
];

export const FORMAT_CUE_GROUPS: readonly FormatCueGroup[] = [
  {
    format: "table",
    phrases: [],
    tokens: ["table", "tabular"],
  },
  {
    format: "steps",
    phrases: ["step by step"],
    tokens: ["steps", "step", "numbered"],
  },
  {
    format: "list",
    phrases: ["as a list", "in a list"],
    tokens: ["bullet", "bullets"],
  },
];

function uniqueLongestFirst(items: Iterable<string>): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const item of items) {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    list.push(normalized);
  }
  list.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return list;
}

function uniqueTokens(items: Iterable<string>): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const item of items) {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    list.push(normalized);
  }
  return list;
}

function collectPhrases(): string[] {
  const phrases: string[] = [];
  for (const group of STYLE_CUE_GROUPS) phrases.push(...group.phrases);
  for (const group of LENGTH_CUE_GROUPS) phrases.push(...group.phrases);
  for (const group of FORMAT_CUE_GROUPS) phrases.push(...group.phrases);
  return uniqueLongestFirst(phrases);
}

function collectTokens(): string[] {
  const tokens: string[] = [];
  for (const group of STYLE_CUE_GROUPS) tokens.push(...group.tokens);
  for (const group of LENGTH_CUE_GROUPS) tokens.push(...group.tokens);
  for (const group of FORMAT_CUE_GROUPS) tokens.push(...group.tokens);
  return uniqueTokens(tokens);
}

/** Longest-first multi-word instruction phrases (retrieval strip + detection) */
export const ANSWER_STYLE_PHRASES: readonly string[] = collectPhrases();

/** Single-token instruction words including common stems */
export const ANSWER_STYLE_TOKENS: readonly string[] = collectTokens();

export const ANSWER_STYLE_PHRASE_SET = new Set(ANSWER_STYLE_PHRASES);
export const ANSWER_STYLE_TOKEN_SET = new Set(ANSWER_STYLE_TOKENS);

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a case-insensitive word-boundary pattern for a phrase or token */
export function cueToPattern(cue: string): RegExp {
  const escaped = escapeRegExp(cue.trim().toLowerCase()).replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i");
}
