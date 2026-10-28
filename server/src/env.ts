/**
 * Environment configuration loader.
 * Must be imported at the very top of server entry points before any other imports,
 * ensuring process.env is populated before dependent modules initialize.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.backend first (backend secrets / server config)
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.backend") });

// Also load .env.local as fallback (for shared GOOGLE_CLIENT_ID)
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

// Also load standard .env if present
dotenv.config();
