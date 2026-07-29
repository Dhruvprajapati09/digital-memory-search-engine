import express from "express";
import { protect } from "../middleware/auth.middleware";
import {
  searchHandler,
  searchV2Handler,
  getSearchV2SuggestionsHandler,
  getSearchV2DashboardHandler,
  evaluateSearchV2BenchmarkHandler,
  getSearchHistoryHandler,
  getSearchStatsHandler,
  deleteSearchHistoryItemHandler,
  clearSearchHistoryHandler,
} from "../controllers/searchController";

const router = express.Router();

router.use(protect);

router.get("/v2/suggestions", getSearchV2SuggestionsHandler);
router.get("/v2/dashboard", getSearchV2DashboardHandler);
router.post("/v2/benchmark", evaluateSearchV2BenchmarkHandler);
router.get("/v2", searchV2Handler);
router.get("/stats", getSearchStatsHandler);
router.get("/history", getSearchHistoryHandler);
router.delete("/history", clearSearchHistoryHandler);
router.delete("/history/:id", deleteSearchHistoryItemHandler);
router.get("/", searchHandler);

export default router;
