import "./env.ts";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { apiRouter } from "./routes.ts";
import { getClientId } from "./auth.ts";
import { testFirestoreConnection, isConnectedToFirestore } from "./firestore.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    database: "Google Cloud Firestore",
    firestoreConnected: isConnectedToFirestore(),
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
  console.log(`   OAuth Audience: ${getClientId() ? "configured" : "none"}`);
  void testFirestoreConnection();
});
