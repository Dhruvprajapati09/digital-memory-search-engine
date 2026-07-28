/** Deterministic technical synonym / related-term map (no LLM) */
const TECH_SYNONYMS: Record<string, string[]> = {
  mongodb: [
    "mongo",
    "database",
    "nosql",
    "document database",
    "collection",
  ],
  indexing: [
    "index",
    "database index",
    "compound index",
    "b tree",
    "b-tree",
    "performance",
    "query optimization",
  ],
  react: ["hooks", "jsx", "component", "frontend", "ui library"],
  node: ["nodejs", "node.js", "server-side javascript", "runtime"],
  express: ["middleware", "router", "web framework", "api server"],
  jwt: ["json web token", "authentication", "token", "authorization"],
  redis: ["cache", "in-memory", "key-value store"],
  docker: ["container", "containerization", "image", "deployment"],
  algorithm: ["algorithms", "complexity", "data structure", "big o"],
  networking: ["tcp", "udp", "http", "protocol", "socket"],
  database: ["sql", "nosql", "schema", "query", "storage"],
  api: ["rest", "rest api", "endpoint", "http api"],
  typescript: ["ts", "types", "static typing"],
  javascript: ["js", "ecmascript"],
  python: ["pip", "django", "flask"],
  kubernetes: ["k8s", "orchestration", "pods", "deployment"],
  machine: ["ml", "model", "training", "inference"],
  search: ["retrieval", "query", "ranking", "index"],
  embedding: ["vector", "semantic", "similarity"],
  rag: ["retrieval augmented generation", "context", "llm"],
};

const ABBREVIATIONS: Record<string, string[]> = {
  os: ["operating system"],
  db: ["database"],
  idx: ["index", "indexing"],
  auth: ["authentication", "authorization"],
  perf: ["performance"],
  cfg: ["configuration", "config"],
  env: ["environment", "environment variable"],
  ts: ["typescript"],
  js: ["javascript"],
  ml: ["machine learning"],
  nlp: ["natural language processing"],
  ci: ["continuous integration"],
  cd: ["continuous deployment"],
};

export interface QueryExpansionOptions {
  keywords: string[];
  entities: string[];
  vocabulary?: {
    keywords?: Iterable<string>;
    concepts?: Iterable<string>;
    tags?: Iterable<string>;
  };
  limit?: number;
}

/**
 * Deterministic query expansion from synonyms, abbreviations, and indexed vocabulary.
 */
export function expandQueryTerms(options: QueryExpansionOptions): string[] {
  const limit = options.limit ?? 20;
  const expanded = new Set<string>();

  const seedTerms = [
    ...options.keywords,
    ...options.entities.map((e) => e.toLowerCase()),
  ];

  for (const term of seedTerms) {
    const lower = term.toLowerCase().trim();
    if (lower.length >= 2) expanded.add(lower);

    // Direct synonym lookup
    if (TECH_SYNONYMS[lower]) {
      for (const syn of TECH_SYNONYMS[lower]) expanded.add(syn);
    }

    // Partial synonym match (e.g. "mongodb indexing" → mongodb + indexing)
    for (const [key, syns] of Object.entries(TECH_SYNONYMS)) {
      if (lower.includes(key) || key.includes(lower)) {
        expanded.add(key);
        for (const syn of syns) expanded.add(syn);
      }
    }

    // Abbreviations
    if (ABBREVIATIONS[lower]) {
      for (const full of ABBREVIATIONS[lower]) expanded.add(full);
    }
  }

  // Vocabulary overlap — terms from index that share stems with query keywords
  if (options.vocabulary) {
    const allVocab = [
      ...(options.vocabulary.keywords ?? []),
      ...(options.vocabulary.concepts ?? []),
      ...(options.vocabulary.tags ?? []),
    ];

    for (const vocabTerm of allVocab) {
      const lowerVocab = vocabTerm.toLowerCase();
      for (const seed of seedTerms) {
        const lowerSeed = seed.toLowerCase();
        if (
          lowerVocab.includes(lowerSeed) ||
          lowerSeed.includes(lowerVocab) ||
          lowerVocab.split(/\s+/).some((w) => w.startsWith(lowerSeed.slice(0, 4)))
        ) {
          expanded.add(lowerVocab);
        }
      }
    }
  }

  // Remove seed terms from expansion output (keep only added terms + seeds for retrieval)
  const result = [...expanded].filter((t) => t.length >= 2);
  return result.slice(0, limit);
}

/** Build a single string for MongoDB $text / keyword search */
export function buildExpandedSearchQuery(
  normalized: string,
  keywords: string[],
  expandedTerms: string[]
): string {
  const parts = new Set<string>([normalized, ...keywords, ...expandedTerms]);
  return [...parts].join(" ");
}

/** Build enriched text for embedding generation */
export function buildExpandedEmbeddingQuery(
  normalized: string,
  keywords: string[],
  expandedTerms: string[],
  maxExtraTerms = 8
): string {
  const extras = expandedTerms
    .filter((t) => !normalized.includes(t))
    .slice(0, maxExtraTerms);

  if (extras.length === 0) return normalized;
  return `${normalized} ${extras.join(" ")}`.trim();
}
