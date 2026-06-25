import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import documentRoutes from "./routes/documentRoutes";
import searchRoutes from "./routes/searchRoutes";
import chatRoutes from "./routes/chatRoutes";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error.middleware";
import { UPLOAD_DIR } from "./middleware/upload";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" }));

// Serve uploaded files (images/PDFs) for previews
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/chat", chatRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

export default app;
