import mongoose from "mongoose";
import ChunkModel from "../../models/Chunk";
import DocumentModel from "../../models/Document";
import type { UserVocabulary } from "../../types/query";

const VOCAB_TTL_MS = 5 * 60 * 1000;
const vocabCache = new Map<string, { loadedAt: number; vocab: UserVocabulary }>();

/**
 * Load user-specific vocabulary from indexed chunks and documents.
 * Cached briefly to avoid repeated MongoDB aggregation per query.
 */
export async function loadUserVocabulary(
  userId: string
): Promise<UserVocabulary> {
  const cached = vocabCache.get(userId);
  if (cached && Date.now() - cached.loadedAt < VOCAB_TTL_MS) {
    return cached.vocab;
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [keywordAgg, conceptAgg, tagAgg, documents] = await Promise.all([
    ChunkModel.aggregate<{ _id: string }>([
      { $match: { userId: userObjectId } },
      { $unwind: "$keywords" },
      { $group: { _id: "$keywords" } },
      { $limit: 500 },
    ]),
    ChunkModel.aggregate<{ _id: string }>([
      { $match: { userId: userObjectId } },
      { $unwind: "$concepts" },
      { $group: { _id: "$concepts" } },
      { $limit: 500 },
    ]),
    ChunkModel.aggregate<{ _id: string }>([
      { $match: { userId: userObjectId } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags" } },
      { $limit: 200 },
    ]),
    DocumentModel.find({ userId: userObjectId, indexStatus: "indexed" })
      .select("title")
      .limit(200)
      .lean(),
  ]);

  const vocab: UserVocabulary = {
    keywords: new Set(keywordAgg.map((k) => k._id).filter(Boolean)),
    concepts: new Set(conceptAgg.map((c) => c._id).filter(Boolean)),
    tags: new Set(tagAgg.map((t) => t._id).filter(Boolean)),
    documentTitles: new Set(documents.map((d) => d.title).filter(Boolean)),
  };

  vocabCache.set(userId, { loadedAt: Date.now(), vocab });
  return vocab;
}

/** Clear cache (for tests) */
export function clearVocabularyCache(): void {
  vocabCache.clear();
}
