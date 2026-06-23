import express from "express";
import {
  uploadDocument,
  createNote,
  getDocuments,
  getDocument,
  reprocessDocument,
  deleteDocument,
} from "../controllers/documentController";
import { protect } from "../middleware/auth.middleware";
import { uploadSingle, handleUploadError } from "../middleware/upload";

const router = express.Router();

// All document routes require authentication
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
router.get("/", getDocuments);

// Register reprocess before generic :id routes
router.post("/:id/reprocess", reprocessDocument);
router.get("/:id", getDocument);
router.delete("/:id", deleteDocument);

export default router;
