import type { SearchV2Facet, SearchV2RankedChunk } from "../../types/searchV2";

function addValue(map: Map<string, number>, value: unknown): void {
  if (typeof value !== "string" && typeof value !== "number") return;
  const normalized = String(value).trim();
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toFacet(field: string, values: Map<string, number>): SearchV2Facet {
  return {
    field,
    values: [...values.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([value, count]) => ({ value, count })),
  };
}

export function buildSearchV2Facets(
  chunks: SearchV2RankedChunk[]
): SearchV2Facet[] {
  const maps = {
    document: new Map<string, number>(),
    page: new Map<string, number>(),
    chapter: new Map<string, number>(),
    section: new Map<string, number>(),
    heading: new Map<string, number>(),
    tags: new Map<string, number>(),
    language: new Map<string, number>(),
    fileType: new Map<string, number>(),
    entity: new Map<string, number>(),
    topic: new Map<string, number>(),
  };

  for (const item of chunks) {
    const chunk = item.chunk;
    addValue(maps.document, chunk.metadata.documentTitle);
    addValue(maps.page, chunk.metadata.pageNumber);
    addValue(maps.chapter, chunk.metadata.chapter);
    addValue(maps.section, chunk.metadata.section);
    addValue(maps.heading, chunk.metadata.heading);
    addValue(maps.language, chunk.metadata.language);
    addValue(maps.fileType, chunk.metadata.type);
    addValue(maps.topic, chunk.topic);

    for (const tag of chunk.tags ?? []) addValue(maps.tags, tag);
    for (const entity of chunk.metadata.entities ?? []) {
      addValue(maps.entity, entity.name);
    }
  }

  return Object.entries(maps)
    .map(([field, values]) => toFacet(field, values))
    .filter((facet) => facet.values.length > 0);
}
