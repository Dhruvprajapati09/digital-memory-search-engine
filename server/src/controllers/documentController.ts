import { Request, Response } from "express";
import fs from "fs/promises";
import mongoose from "mongoose";
import DocumentModel, { IDocument } from "../models/Document";
import { asyncHandler, AppError } from "../middleware/error.middleware";
import {
  queueExtraction,
  runExtractionForDocument,
  resolveSafeUploadPath,
} from "../services/extractionService";
import { cleanText } from "../services/textCleaner";

/** Shape documents consistently for API list responses */
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
    extractedText: doc.extractedText,
    extractionStatus: doc.extractionStatus,
    extractionError: doc.extractionError,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Detail response includes `status` alias for extraction state */
function formatDocumentDetail(doc: IDocument) {
  return {
    ...formatDocument(doc),
    status: doc.extractionStatus,
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

function parseDocumentId(id: string | string[] | undefined): string {
  if (!id || typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid document ID", 400);
  }
  return id;
}

async function getOwnedDocument(
  req: Request,
  documentId: string
): Promise<IDocument> {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const document = await DocumentModel.findById(documentId);

  if (!document) {
    throw new AppError("Document not found", 404);
  }

  if (document.userId.toString() !== req.user._id.toString()) {
    throw new AppError("Unauthorized access to this document", 403);
  }

  return document;
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
    const relativePath = `uploads/${req.file.filename}`;

    const document = await DocumentModel.create({
      userId: req.user._id,
      title,
      type: docType,
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      filePath: relativePath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      extractionStatus: "pending",
    });

    // Run extraction in background — response returns immediately with pending status
    queueExtraction(document._id.toString());

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
  const cleanedContent = cleanText(content);

  const document = await DocumentModel.create({
    userId: req.user._id,
    title,
    type: "note",
    noteContent: content,
    extractedText: cleanedContent,
    extractionStatus: "completed",
    extractionError: null,
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

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const documentId = parseDocumentId(req.params.id);
  const document = await getOwnedDocument(req, documentId);

  res.status(200).json({
    success: true,
    document: formatDocumentDetail(document),
  });
});

export const reprocessDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const documentId = parseDocumentId(req.params.id);
    const document = await getOwnedDocument(req, documentId);

    if (document.type === "note") {
      const cleaned = cleanText(document.noteContent ?? "");
      document.extractedText = cleaned;
      document.extractionStatus = cleaned ? "completed" : "failed";
      document.extractionError = cleaned ? null : "Note content is empty";
      await document.save();
    } else {
      document.extractionStatus = "processing";
      document.extractionError = null;
      await document.save();
      queueExtraction(documentId);
    }

    res.status(200).json({ success: true });
  }
);

export const deleteDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const documentId = parseDocumentId(req.params.id);
    const document = await getOwnedDocument(req, documentId);

    if (document.storedFileName) {
      const absolutePath = resolveSafeUploadPath(document.storedFileName);

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
