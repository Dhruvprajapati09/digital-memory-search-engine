import express from "express";
import { protect } from "../middleware/auth.middleware";
import {
  importYouTubeHandler,
  getYouTubeVideoHandler,
} from "../controllers/youtubeController";

const router = express.Router();

router.use(protect);

/** Import a YouTube video by URL — fetches transcript and indexes into vector DB */
router.post("/import", importYouTubeHandler);

/** Get imported video details by record ID */
router.get("/:videoId", getYouTubeVideoHandler);

export default router;
