import { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/error.middleware";
import { importYouTubeVideo, getVideoById } from "../services/youtube/youtubeImporter";

export const importYouTubeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { url } = req.body as { url?: string };

    if (!url || typeof url !== "string") {
      throw new AppError("YouTube URL is required", 400);
    }

    const result = await importYouTubeVideo(req.user._id.toString(), url);

    res.status(result.duplicate ? 200 : 201).json(result);
  }
);

export const getYouTubeVideoHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { videoId: videoRecordParam } = req.params;
    const videoRecordId = Array.isArray(videoRecordParam)
      ? videoRecordParam[0]
      : videoRecordParam;

    if (!videoRecordId) {
      throw new AppError("Video ID is required", 400);
    }

    const video = await getVideoById(
      req.user._id.toString(),
      videoRecordId
    );

    if (!video) {
      throw new AppError("Video not found", 404);
    }

    res.status(200).json({ success: true, video });
  }
);
