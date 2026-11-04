/**
 * Firestore Service Provider for SupportHub.
 *
 * Implements Google Cloud Firestore integration.
 * If credentials or project are unavailable, provides a graceful fallback to the local file store.
 */
import { Firestore } from "@google-cloud/firestore";
import type { Settings } from "@google-cloud/firestore";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { Ticket, TicketMessage, UserRecord, AuditEntry } from "./types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let firestoreInstance: Firestore | null = null;
let isFirestoreAvailable = false;

export function initFirestore(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "ticket-513706";
  const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";

  // Check for service account key path
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : path.join(__dirname, "..", "..", "service-account.json");

  const settings: Settings = {
    projectId,
    databaseId,
  };

  if (fs.existsSync(keyFilePath)) {
    settings.keyFilename = keyFilePath;
    console.log(`🔑 Using Firestore credentials from: ${keyFilePath}`);
  } else if (!process.env.K_SERVICE && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // We are running in local dev and no key file or ADC was explicitly set.
    // Avoid triggering unhandled gRPC background ADC lookup rejection.
    console.log(`ℹ️ Firestore: No service-account.json or GOOGLE_APPLICATION_CREDENTIALS found locally.`);
    console.log(`📂 Cloud Run will use IAM default credentials automatically; local dev uses persistent store.json.`);
    firestoreInstance = null;
    isFirestoreAvailable = false;
    return null;
  }

  try {
    firestoreInstance = new Firestore(settings);
    console.log(`📦 Firestore client initialized for project [${projectId}], database [${databaseId}]`);
    return firestoreInstance;
  } catch (err) {
    console.warn("⚠️ Firestore client initialization failed:", err);
    firestoreInstance = null;
    return null;
  }
}

export function getFirestore(): Firestore | null {
  if (!firestoreInstance) {
    return initFirestore();
  }
  return firestoreInstance;
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const db = getFirestore();
    if (!db) {
      isFirestoreAvailable = false;
      return false;
    }

    const collectionName = process.env.FIRESTORE_TICKETS_COLLECTION || "tickets";
    await db.collection(collectionName).limit(1).get();
    isFirestoreAvailable = true;
    console.log(`✅ Connected successfully to Google Cloud Firestore [${collectionName}]`);
    return true;
  } catch (err: any) {
    isFirestoreAvailable = false;
    const msg = err?.message || String(err);
    if (msg.includes("Could not load the default credentials") || msg.includes("NO_ADC_FOUND")) {
      console.log(`ℹ️ Firestore: No local ADC credentials found. In Google Cloud Run deployment, Cloud IAM credentials attach automatically.`);
    } else {
      console.warn(`⚠️ Firestore test connection notice: ${msg}`);
    }
    console.log(`📂 Using persistent store.json with Firestore auto-sync.`);
    return false;
  }
}

export function isConnectedToFirestore(): boolean {
  return isFirestoreAvailable;
}

// ─── Firestore Operations with Fallback to Store ──────────────

export const firestoreService = {
  async saveTicket(ticket: Ticket): Promise<void> {
    const db = getFirestore();
    if (!db || !isFirestoreAvailable) return;
    try {
      const collectionName = process.env.FIRESTORE_TICKETS_COLLECTION || "tickets";
      await db.collection(collectionName).doc(ticket.id).set(ticket);
    } catch (err) {
      console.error("Firestore saveTicket error:", err);
    }
  },

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<void> {
    const db = getFirestore();
    if (!db || !isFirestoreAvailable) return;
    try {
      const collectionName = process.env.FIRESTORE_TICKETS_COLLECTION || "tickets";
      await db.collection(collectionName).doc(id).set(updates, { merge: true });
    } catch (err) {
      console.error("Firestore updateTicket error:", err);
    }
  },

  async saveMessage(msg: TicketMessage): Promise<void> {
    const db = getFirestore();
    if (!db || !isFirestoreAvailable) return;
    try {
      const collectionName = process.env.FIRESTORE_MESSAGES_COLLECTION || "messages";
      await db.collection(collectionName).doc(msg.id).set(msg);
    } catch (err) {
      console.error("Firestore saveMessage error:", err);
    }
  },

  async saveUser(user: UserRecord): Promise<void> {
    const db = getFirestore();
    if (!db || !isFirestoreAvailable) return;
    try {
      const collectionName = process.env.FIRESTORE_USERS_COLLECTION || "users";
      await db.collection(collectionName).doc(user.userId).set(user);
    } catch (err) {
      console.error("Firestore saveUser error:", err);
    }
  },

  async saveAuditEntry(entry: AuditEntry): Promise<void> {
    const db = getFirestore();
    if (!db || !isFirestoreAvailable) return;
    try {
      await db.collection("auditLog").doc(entry.id).set(entry);
    } catch (err) {
      console.error("Firestore saveAuditEntry error:", err);
    }
  },
};
