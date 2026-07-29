import type { QueryIntent } from "../../types/query";

interface IntentPattern {
  intent: QueryIntent;
  patterns: RegExp[];
  weight: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "definition",
    patterns: [
      /\bwhat is\b/,
      /\bwhat are\b/,
      /\bdefine\b/,
      /\bdefinition of\b/,
      /\bmeaning of\b/,
      /\bexplain what\b/,
    ],
    weight: 1,
  },
  {
    intent: "comparison",
    patterns: [
      /\bvs\.?\b/,
      /\bversus\b/,
      /\bcompare\b/,
      /\bdifference between\b/,
      /\bbetter than\b/,
      /\bwhich is better\b/,
    ],
    weight: 1,
  },
  {
    intent: "tutorial",
    patterns: [
      /\bhow to\b/,
      /\bstep by step\b/,
      /\bguide to\b/,
      /\btutorial\b/,
      /\bwalkthrough\b/,
      /\bhow do i\b/,
      /\bhow can i\b/,
    ],
    weight: 1,
  },
  {
    intent: "code",
    patterns: [
      /\bcode\b/,
      /\bimplement\b/,
      /\bsyntax\b/,
      /\bfunction\b/,
      /\bclass\b/,
      /\bapi call\b/,
      /\bsnippet\b/,
      /```/,
    ],
    weight: 0.9,
  },
  {
    intent: "summary",
    patterns: [
      /\bsummarize\b/,
      /\bsummary of\b/,
      /\boverview of\b/,
      /\btldr\b/,
      /\bin short\b/,
      /\bkey points\b/,
    ],
    weight: 1,
  },
  {
    intent: "lookup",
    patterns: [
      /\bfind\b/,
      /\bwhere is\b/,
      /\bshow me\b/,
      /\blocate\b/,
      /\bsearch for\b/,
      /\blook up\b/,
    ],
    weight: 0.85,
  },
  {
    intent: "examples",
    patterns: [
      /\bexamples?\b/,
      /\bsample\b/,
      /\bdemo\b/,
      /\bfor instance\b/,
      /\bsuch as\b/,
    ],
    weight: 0.9,
  },
  {
    intent: "classification",
    patterns: [
      /\btypes of\b/,
      /\bkinds of\b/,
      /\bcategories\b/,
      /\bclassify\b/,
      /\blist all\b/,
    ],
    weight: 0.85,
  },
];

export interface IntentDetectionResult {
  intent: QueryIntent;
  confidence: number;
}

/**
 * Deterministic rule-based intent detection (no LLM).
 */
export function detectIntent(normalizedQuery: string): IntentDetectionResult {
  const query = normalizedQuery.trim();

  if (!query) {
    return { intent: "search", confidence: 0.5 };
  }

  if (query.endsWith("?")) {
    return { intent: "question", confidence: 0.75 };
  }

  const scores = new Map<QueryIntent, number>();

  for (const { intent, patterns, weight } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        scores.set(intent, (scores.get(intent) ?? 0) + weight);
      }
    }
  }

  if (scores.size === 0) {
    return { intent: "search", confidence: 0.6 };
  }

  let bestIntent: QueryIntent = "search";
  let bestScore = 0;

  for (const [intent, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  const confidence = Math.min(0.95, 0.5 + bestScore * 0.15);

  return { intent: bestIntent, confidence };
}
