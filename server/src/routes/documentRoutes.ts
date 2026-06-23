import express from "express";
import {
  uploadDocument,
  createNote,
  getDocuments,
  getDocumentStats,
  getDocument,
  getDocumentIndexStatus,
  getDocumentChunksHandler,
  reprocessDocument,
  reindexDocumentHandler,
  deleteDocument,
} from "../controllers/documentController";
import { protect } from "../middleware/auth.middleware";
import { uploadSingle, handleUploadError } from "../middleware/upload";

const router = express.Router();

router.use(protect);

router.post(
  "/upload",
  (req, res, next) => {
    uploadSingle(req, res, (err) => {
      if (err) {
        handleUploadError(err, req, res, next);
        return;
      }
      next();
    });
  },
  uploadDocument
);

router.post("/note", createNote);
router.get("/stats", getDocumentStats);
router.get("/", getDocuments);

router.post("/:id/reprocess", reprocessDocument);
router.post("/:id/reindex", reindexDocumentHandler);
router.get("/:id/chunks", getDocumentChunksHandler);
router.get("/:id/index-status", getDocumentIndexStatus);
router.get("/:id", getDocument);
router.delete("/:id", deleteDocument);

export default router;
