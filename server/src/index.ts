import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { apiRouter } from "./routes.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend environment variables
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.backend") });
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });
dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Mount the API router at /api
app.use("/api", apiRouter);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    gcpProject: process.env.GCP_PROJECT_ID || "ticket-511417",
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend static build in production container / deployed mode
const distPath = path.join(__dirname, "..", "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`🚀 SupportHub GCP Backend running on http://localhost:${port}`);
  console.log(`   GCP Project: ${process.env.GCP_PROJECT_ID || "ticket-511417"}`);
  console.log(`   OAuth Audience: ${process.env.GOOGLE_CLIENT_ID ? "configured" : "none"}`);
});
