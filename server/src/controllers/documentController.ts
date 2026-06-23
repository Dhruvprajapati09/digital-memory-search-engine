import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import DocumentModel, { IDocument } from "../models/Document";
import { asyncHandler, AppError } from "../middleware/error.middleware";
import { UPLOAD_DIR } from "../middleware/upload";

/** Shape documents consistently for API responses */
function formatDocument(doc: IDocument) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    type: doc.type,
    originalFileName: doc.originalFileName,
    storedFileName: doc.storedFileName,
    filePath: doc.filePath,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    noteContent: doc.noteContent,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function sanitizeText(value: unknown, fieldName: string, maxLength = 200): string {
  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new AppError(`${fieldName} cannot be empty`, 400);
  }

  if (trimmed.length > maxLength) {
    throw new AppError(
      `${fieldName} cannot exceed ${maxLength} characters`,
      400
    );
  }

  return trimmed;
}

function getDocumentTypeFromMime(mimeType: string): "pdf" | "image" {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  throw new AppError("Unsupported file type", 400);
}

function resolveSafeFilePath(filePath: string): string {
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.resolve(UPLOAD_DIR, normalized);

  if (!absolutePath.startsWith(UPLOAD_DIR)) {
    throw new AppError("Invalid file path", 400);
  }

  return absolutePath;
}

export const uploadDocument = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    if (!req.file) {
      throw new AppError("No file uploaded. Please select a PDF or image.", 400);
    }

    const title = req.body.title
      ? sanitizeText(req.body.title, "Title")
      : req.file.originalname;

    const docType = getDocumentTypeFromMime(req.file.mimetype);
    const relativePath = path.join("uploads", req.file.filename);

    const document = await DocumentModel.create({
      userId: req.user._id,
      title,
      type: docType,
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      filePath: relativePath.replace(/\\/g, "/"),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    res.status(201).json({
      success: true,
      document: formatDocument(document),
    });
  }
);

export const createNote = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const title = sanitizeText(req.body.title, "Title");
  const content = sanitizeText(req.body.content, "Content", 10000);

  const document = await DocumentModel.create({
    userId: req.user._id,
    title,
    type: "note",
    noteContent: content,
  });

  res.status(201).json({
    success: true,
    document: formatDocument(document),
  });
});

export const getDocuments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const documents = await DocumentModel.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .exec();

  res.status(200).json({
    success: true,
    documents: documents.map(formatDocument),
  });
});

export const deleteDocument = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const id = req.params.id;

    if (!id || typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid document ID", 400);
    }

    const document = await DocumentModel.findById(id);

    if (!document) {
      throw new AppError("Document not found", 404);
    }

    if (document.userId.toString() !== req.user._id.toString()) {
      throw new AppError("Unauthorized access to this document", 403);
    }

    if (document.storedFileName) {
      const absolutePath = resolveSafeFilePath(document.storedFileName);

      try {
        await fs.unlink(absolutePath);
      } catch (err) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code !== "ENOENT") {
          throw err;
        }
      }
    }

    await document.deleteOne();

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  }
);
