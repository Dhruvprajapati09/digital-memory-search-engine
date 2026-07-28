/** Static dictionary of common technical entities */
export const TECH_ENTITY_DICTIONARY: string[] = [
  "MongoDB",
  "React",
  "Node.js",
  "Express",
  "JWT",
  "REST API",
  "Redis",
  "Docker",
  "Operating System",
  "Algorithms",
  "Networking",
  "Data Structures",
  "JavaScript",
  "TypeScript",
  "Python",
  "PostgreSQL",
  "MySQL",
  "GraphQL",
  "Kubernetes",
  "AWS",
  "Azure",
  "GCP",
  "Pinecone",
  "Mistral",
  "OpenAI",
  "TensorFlow",
  "PyTorch",
  "Machine Learning",
  "Deep Learning",
  "Natural Language Processing",
  "WebSocket",
  "HTTP",
  "HTTPS",
  "OAuth",
  "OAuth2",
  "CSS",
  "HTML",
  "Vue",
  "Angular",
  "Next.js",
  "Webpack",
  "Vite",
  "Git",
  "GitHub",
  "CI/CD",
  "Microservices",
  "API",
  "NoSQL",
  "SQL",
  "B Tree",
  "B-Tree",
  "Indexing",
  "Compound Index",
  "Database Index",
];

/** Build case-insensitive lookup map */
function buildDictionaryMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entity of TECH_ENTITY_DICTIONARY) {
    map.set(entity.toLowerCase(), entity);
  }
  return map;
}

const DICTIONARY_MAP = buildDictionaryMap();

/** Regex for CamelCase / PascalCase identifiers */
const CAMEL_CASE_REGEX = /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g;

/** Regex for dotted tech names e.g. Node.js */
const DOTTED_NAME_REGEX = /\b[A-Za-z]+(?:\.[A-Za-z]+)+\b/g;

/** Regex for ALL-CAPS acronyms (2+ chars) */
const ACRONYM_REGEX = /\b[A-Z]{2,}\b/g;

export interface EntityExtractionOptions {
  normalizedQuery: string;
  vocabulary?: {
    concepts?: Iterable<string>;
    keywords?: Iterable<string>;
    documentTitles?: Iterable<string>;
  };
}

/**
 * Extract technical entities using dictionary, regex, and indexed vocabulary.
 */
export function extractEntities(options: EntityExtractionOptions): string[] {
  const { normalizedQuery, vocabulary } = options;
  const found = new Map<string, string>();
  const lowerQuery = normalizedQuery.toLowerCase();

  // Dictionary match — longest first to prefer "REST API" over "API"
  const sortedDict = [...DICTIONARY_MAP.entries()].sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [lower, canonical] of sortedDict) {
    const pattern = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${pattern.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (regex.test(normalizedQuery)) {
      found.set(lower, canonical);
    }
  }

  // Regex extractions from query
  const camelMatches = normalizedQuery.match(CAMEL_CASE_REGEX) ?? [];
  for (const m of camelMatches) found.set(m.toLowerCase(), m);

  const dottedMatches = normalizedQuery.match(DOTTED_NAME_REGEX) ?? [];
  for (const m of dottedMatches) found.set(m.toLowerCase(), m);

  const acronymMatches = normalizedQuery.match(ACRONYM_REGEX) ?? [];
  for (const m of acronymMatches) {
    if (m.length >= 2) found.set(m.toLowerCase(), m);
  }

  // Vocabulary from indexed content
  if (vocabulary?.concepts) {
    for (const concept of vocabulary.concepts) {
      const lower = concept.toLowerCase();
      if (lower.length >= 3 && lowerQuery.includes(lower)) {
        found.set(lower, concept);
      }
    }
  }

  if (vocabulary?.keywords) {
    for (const kw of vocabulary.keywords) {
      const lower = kw.toLowerCase();
      if (lower.length >= 3 && lowerQuery.includes(lower)) {
        found.set(lower, kw);
      }
    }
  }

  if (vocabulary?.documentTitles) {
    for (const title of vocabulary.documentTitles) {
      const lower = title.toLowerCase();
      if (lower.length >= 4 && lowerQuery.includes(lower)) {
        found.set(lower, title);
      }
    }
  }

  return [...found.values()];
}
