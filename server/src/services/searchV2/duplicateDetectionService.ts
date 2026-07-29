import type { SearchV2RankedChunk } from "../../types/searchV2";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function signature(value: string): string {
  return normalizeText(value)
    .split(/\s+/)
    .filter((term) => term.length >= 4)
    .slice(0, 50)
    .sort()
    .join(" ");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function shingles(value: string): Set<string> {
  const terms = normalizeText(value).split(/\s+/).filter(Boolean);
  const grams = new Set<string>();
  for (let i = 0; i < terms.length - 2; i += 1) {
    grams.add(`${terms[i]} ${terms[i + 1]} ${terms[i + 2]}`);
  }
  return grams;
}

export function markDuplicateChunks(
  chunks: SearchV2RankedChunk[],
  threshold = 0.92
): SearchV2RankedChunk[] {
  const exactSeen = new Map<string, string>();
  const prior: Array<{ id: string; shingles: Set<string> }> = [];

  return chunks.map((item) => {
    const id = item.chunk.vectorId;
    const sig = signature(item.chunk.text);
    const exactDuplicate = exactSeen.get(sig);

    if (exactDuplicate) {
      return { ...item, duplicateOf: exactDuplicate };
    }

    const itemShingles = shingles(item.chunk.text);
    const nearDuplicate = prior.find(
      (candidate) => jaccard(itemShingles, candidate.shingles) >= threshold
    );

    exactSeen.set(sig, id);
    prior.push({ id, shingles: itemShingles });

    if (nearDuplicate) {
      return { ...item, duplicateOf: nearDuplicate.id };
    }

    return item;
  });
}
