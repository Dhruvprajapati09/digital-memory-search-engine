import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, AppError } from "../middleware/error.middleware";
import { searchDocuments } from "../services/searchService";
import {
  getRecentSearches,
  deleteSearchHistoryItem,
  clearSearchHistory,
  getSearchStats,
} from "../services/searchHistoryService";
import type { SearchRequest } from "../types/search";

function parseHistoryId(id: string): string {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid search history id", 400);
  }

  return id;
}

export const searchHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const params: SearchRequest = {
      q: String(req.query.q ?? ""),
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      type: req.query.type as SearchRequest["type"],
      date: req.query.date as SearchRequest["date"],
      dateFrom: req.query.dateFrom
        ? String(req.query.dateFrom)
        : undefined,
      dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
    };

    const result = await searchDocuments(req.user._id.toString(), params);

    res.status(200).json(result);
  }
);

export const getSearchHistoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const queries = await getRecentSearches(req.user._id.toString());

    res.status(200).json({
      success: true,
      history: queries,
    });
  }
);

export const getSearchStatsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const stats = await getSearchStats(req.user._id.toString());

    res.status(200).json({
      success: true,
      stats,
    });
  }
);

export const deleteSearchHistoryItemHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const historyId = parseHistoryId(String(req.params.id));
    const deleted = await deleteSearchHistoryItem(
      req.user._id.toString(),
      historyId
    );

    if (!deleted) {
      throw new AppError("Search history item not found", 404);
    }

    res.status(200).json({ success: true });
  }
);

export const clearSearchHistoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const deletedCount = await clearSearchHistory(req.user._id.toString());

    res.status(200).json({
      success: true,
      deletedCount,
    });
  }
);
