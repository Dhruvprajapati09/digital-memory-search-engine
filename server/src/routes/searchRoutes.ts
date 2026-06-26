import express from "express";
import { protect } from "../middleware/auth.middleware";
import {
  searchHandler,
  getSearchHistoryHandler,
  getSearchStatsHandler,
  deleteSearchHistoryItemHandler,
  clearSearchHistoryHandler,
  askMemoryHandler,
} from "../controllers/searchController";

const router = express.Router();

router.use(protect);

router.get("/stats", getSearchStatsHandler);
router.get("/history", getSearchHistoryHandler);
router.delete("/history", clearSearchHistoryHandler);
router.delete("/history/:id", deleteSearchHistoryItemHandler);
router.post("/ask", askMemoryHandler);
router.get("/", searchHandler);

export default router;
