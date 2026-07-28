import mongoose from "mongoose";
import ChunkModel from "../../models/Chunk";
import DocumentModel from "../../models/Document";
import { getRecentSearches } from "../searchHistoryService";
import type { SearchV2Suggestion } from "../../types/searchV2";
import {
  buildSearchCacheKey,
  getCachedSuggestions,
  setCachedSuggestions,
} from "./searchCacheService";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pushSuggestion(
  suggestions: Map<string, SearchV2Suggestion>,
  suggestion: SearchV2Suggestion
): void {
  const key = `${suggestion.type}:${suggestion.value.toLowerCase()}`;
  const existing = suggestions.get(key);
  if (!existing || suggestion.score > existing.score) {
    suggestions.set(key, suggestion);
  }
}

export async function getSearchV2Suggestions(
  userId: string,
  prefix: string,
  limit = 8
): Promise<SearchV2Suggestion[]> {
  const normalized = prefix.trim().toLowerCase();
  const cacheKey = buildSearchCacheKey(userId, {
    kind: "suggestions",
    prefix: normalized,
    limit,
  });
  const cached = getCachedSuggestions<SearchV2Suggestion[]>(cacheKey);
  if (cached) return cached;

  const suggestions = new Map<string, SearchV2Suggestion>();
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const regex = normalized
    ? new RegExp(escapeRegex(normalized), "i")
    : undefined;

  const [recent, documents, topics, entities] = await Promise.all([
    getRecentSearches(userId),
    DocumentModel.find({
      userId: userObjectId,
      indexStatus: "indexed",
      ...(regex ? { title: regex } : {}),
    })
      .select("title")
      .limit(limit)
      .lean(),
    ChunkModel.distinct("topic", {
      userId: userObjectId,
      ...(regex ? { topic: regex } : {}),
    }),
    ChunkModel.distinct("entities.name", {
      userId: userObjectId,
      ...(regex ? { "entities.name": regex } : {}),
    }),
  ]);

  recent
    .filter((item) => !normalized || item.query.toLowerCase().includes(normalized))
    .slice(0, limit)
    .forEach((item, index) =>
      pushSuggestion(suggestions, {
        type: "recent",
        value: item.query,
        score: 1 - index * 0.05,
      })
    );

  documents.forEach((doc, index) =>
    pushSuggestion(suggestions, {
      type: "document",
      value: doc.title,
      score: 0.85 - index * 0.03,
    })
  );

  (topics as string[]).slice(0, limit).forEach((topic, index) =>
    pushSuggestion(suggestions, {
      type: "topic",
      value: topic,
      score: 0.75 - index * 0.03,
    })
  );

  (entities as string[]).slice(0, limit).forEach((entity, index) =>
    pushSuggestion(suggestions, {
      type: "entity",
      value: entity,
      score: 0.8 - index * 0.03,
    })
  );

  const result = [...suggestions.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  setCachedSuggestions(cacheKey, result);
  return result;
}
