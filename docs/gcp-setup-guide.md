# SupportHub — Google Cloud Platform (GCP) Setup Guide

This guide walks you through setting up everything in the **Google Cloud Console** for end-to-end authentication, database, messaging, and deployment.

---

## 1. Google Cloud Project Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the Project dropdown at the top and select **New Project**.
3. Name your project (e.g., `supporthub-prod` or `supporthub-cloud`).
4. Note your **Project ID** (e.g., `supporthub-prod-123456`).
5. Ensure billing is enabled for your project (required for Cloud Run, Pub/Sub, and Firestore).

---

## 2. End-to-End Authentication Setup (Google Identity Services)

Authentication uses **Google Identity Services (OAuth 2.0 / OpenID Connect)**. The frontend acquires a Google ID Token (`JWT`), and the backend verifies the token using Google's public keys.

### Step 2.1: Configure the OAuth Consent Screen
1. In the GCP Console navigation menu, go to **APIs & Services** → **OAuth consent screen**.
2. Choose **User Type**:
   - **Internal**: If your portal is strictly for employees/users within your Google Workspace organization.
   - **External**: If customers with any Google account (`@gmail.com` or custom domains) should be able to log in.
3. Click **Create** and enter app details:
   - **App name**: `SupportHub`
   - **User support email**: Select your email address.
   - **Developer contact information**: Enter your email address.
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes** and select:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Click **Update** → **Save and Continue**.
7. If configured as *External* in Testing mode, add your test Google account under **Test users**.

### Step 2.2: Create the Web OAuth 2.0 Client ID
1. In the GCP Console, go to **APIs & Services** → **Credentials**.
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**.
3. Select **Application type**: `Web application`.
4. Set **Name**: `SupportHub Web Client`.
5. Under **Authorized JavaScript origins**, click **+ ADD URI**:
   - `http://localhost:5173` *(for local Vite dev)*
   - `http://localhost:3000` *(optional alternative)*
   - `https://your-production-domain.com` *(when deployed)*
6. Under **Authorized redirect URIs**, click **+ ADD URI**:
   - `http://localhost:5173`
   - `https://your-production-domain.com`
7. Click **Create**.
8. A modal will pop up with:
   - **Client ID** (e.g. `123456789012-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`)
   - **Client secret** *(Backend only, NEVER expose on frontend)*
9. Copy the **Client ID** and put it in your `.env.local`:
   ```bash
   VITE_GOOGLE_CLIENT_ID="123456789012-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
   ```

---

## 3. Database: Google Cloud Firestore (Native Mode)

1. In the GCP Console, go to **Firestore** (under Databases).
2. Click **Create Database**.
3. Select **Firestore Native mode** (recommended for web applications and real-time listeners).
4. Select a location close to your users (e.g., `us-central1` or `asia-south1`).
5. Click **Create Database**.
6. The application uses the following collections:
   - `tickets`: stores ticket documents (id, subject, status, priority, category, assignedTeam, timestamps).
   - `messages`: stores conversation thread messages per ticket.
   - `users`: stores user role assignments (`admin`, `agent`, `customer`).

---

## 4. Asynchronous Queue: Google Cloud Pub/Sub

For automatic ticket routing from `POST /api/tickets` to the routing worker:

1. In the GCP Console, go to **Pub/Sub** → **Topics**.
2. Click **Create Topic**:
   - **Topic ID**: `ticket-created`
   - Keep default settings and click **Create**.
3. Click on the topic → **Subscriptions** tab → **Create Subscription**:
   - **Subscription ID**: `ticket-routing-sub`
   - Delivery type: **Pull** (or Push to a Cloud Function URL).
   - Acknowledgement deadline: `60 seconds`.
   - Click **Create**.

---

## 5. Backend API: Cloud Functions (2nd Gen) or Cloud Run

The backend API handles ticket CRUD and routing:

1. Enable the required GCP APIs:
   - Cloud Run API (`run.googleapis.com`)
   - Cloud Functions API (`cloudfunctions.googleapis.com`)
   - Cloud Build API (`cloudbuild.googleapis.com`)
   - Artifact Registry API (`artifactregistry.googleapis.com`)
   - Firestore API (`firestore.googleapis.com`)
   - Pub/Sub API (`pubsub.googleapis.com`)
2. Token Verification in Backend (Node.js):
   ```typescript
   import { OAuth2Client } from "google-auth-library";

   const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

   async function verifyGoogleToken(authHeader: string) {
     const token = authHeader.replace("Bearer ", "");
     const ticket = await client.verifyIdToken({
       idToken: token,
       audience: process.env.GOOGLE_CLIENT_ID,
     });
     const payload = ticket.getPayload();
     return {
       userId: payload.sub,
       email: payload.email,
       name: payload.name,
     };
   }
   ```

---

## 6. Frontend Deployment

You can host the Vite React SPA on:
- **Cloud Storage + Cloud CDN / Load Balancer**: Upload `dist/` to a Cloud Storage bucket configured with website hosting.
- **Cloud Run**: Serve the built SPA using a lightweight Nginx container.
- **Firebase Hosting**: Run `firebase deploy --only hosting` to publish `dist/` instantly with global SSL CDN.

---

## 7. Summary of Collected Values

| Variable | Where to get from Google Cloud Console |
| :--- | :--- |
| `GCP_PROJECT_ID` | Top project selector bar in GCP Console |
| `VITE_GOOGLE_CLIENT_ID` | APIs & Services → Credentials → OAuth 2.0 Client IDs |
| `VITE_API_BASE_URL` | Cloud Run service URL or custom domain |
| `VITE_ADMIN_EMAILS` | Comma-separated admin emails for portal RBAC |
