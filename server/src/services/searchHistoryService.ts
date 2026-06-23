import SearchHistoryModel from "../models/SearchHistory";
import mongoose from "mongoose";
import type { SearchHistoryRecord, SearchStats } from "../types/search";
import DocumentModel from "../models/Document";

const MAX_HISTORY_ITEMS = 20;

export async function saveSearchQuery(
  userId: string,
  query: string,
  resultCount: number,
  searchTimeMs: number
): Promise<void> {
  const trimmed = query.trim();

  if (!trimmed) return;

  // Remove duplicate query so the latest search moves to the top
  await SearchHistoryModel.deleteMany({ userId, query: trimmed });

  await SearchHistoryModel.create({
    userId,
    query: trimmed,
    resultCount,
    searchTimeMs,
  });

  const excess = await SearchHistoryModel.find({ userId })
    .sort({ createdAt: -1 })
    .skip(MAX_HISTORY_ITEMS)
    .select("_id")
    .lean();

  if (excess.length > 0) {
    await SearchHistoryModel.deleteMany({
      _id: { $in: excess.map((item) => item._id) },
    });
  }
}

export async function getRecentSearches(
  userId: string
): Promise<Array<{ id: string; query: string }>> {
  const records = await SearchHistoryModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(MAX_HISTORY_ITEMS)
    .select("query")
    .lean();

  return records.map((record) => ({
    id: record._id.toString(),
    query: record.query,
  }));
}

export async function getSearchHistoryRecords(
  userId: string
): Promise<SearchHistoryRecord[]> {
  const records = await SearchHistoryModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(MAX_HISTORY_ITEMS)
    .lean();

  return records.map((record) => ({
    id: record._id.toString(),
    query: record.query,
    resultCount: record.resultCount,
    searchTimeMs: record.searchTimeMs,
    createdAt: record.createdAt.toISOString(),
  }));
}

export async function deleteSearchHistoryItem(
  userId: string,
  historyId: string
): Promise<boolean> {
  const result = await SearchHistoryModel.deleteOne({
    _id: historyId,
    userId,
  });

  return result.deletedCount > 0;
}

export async function clearSearchHistory(userId: string): Promise<number> {
  const result = await SearchHistoryModel.deleteMany({ userId });
  return result.deletedCount;
}

/** Analytics for dashboard cards */
export async function getSearchStats(userId: string): Promise<SearchStats> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [totalSearches, searchesToday, avgAgg, totalIndexed] =
    await Promise.all([
      SearchHistoryModel.countDocuments({ userId: userObjectId }),
      SearchHistoryModel.countDocuments({
        userId: userObjectId,
        createdAt: { $gte: startOfToday },
      }),
      SearchHistoryModel.aggregate<{ avgResults: number }>([
        { $match: { userId: userObjectId } },
        { $group: { _id: null, avgResults: { $avg: "$resultCount" } } },
      ]),
      DocumentModel.countDocuments({
        userId: userObjectId,
        indexStatus: "indexed",
      }),
    ]);

  return {
    totalSearches,
    searchesToday,
    averageResultsReturned: Math.round(avgAgg[0]?.avgResults ?? 0),
    totalIndexed,
  };
}
