import { useEffect, useRef } from "react";
import { useAuth } from "../lib/auth";
import { Icon } from "../components/icons";
import { Alert } from "../components/ui";

/**
 * Sign-in screen. Backed by Google Cloud Platform via Google Identity Services
 * (OAuth 2.0 / OpenID Connect). It never accepts or stores a password itself —
 * hardcoded demo passwords and credentials are explicitly forbidden.
 */
export function SignIn() {
  const { state, signIn, enterPreviewMode, googleClientId, handleCredentialResponse } =
    useAuth();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const authAvailable = state.status === "anonymous" || state.status === "authenticated";

  // Automatically render Google's official branded sign-in button if GSI SDK is present
  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current || !window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "filled_blue",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 320,
      });
    } catch {
      // Fallback button remains rendered below if GSI renderButton fails
    }
  }, [googleClientId, handleCredentialResponse, authAvailable]);

  return (
    <div className="auth-screen">
      <section className="auth-hero">
        <div className="flex" style={{ gap: 10 }}>
          <span className="brand-mark">S</span>
          <strong style={{ color: "#fff", fontSize: 16 }}>SupportHub</strong>
        </div>

        <div>
          <h1>Cloud customer support, end to end.</h1>
          <p>
            Submit tickets, watch them get routed automatically to the right team, and
            follow every reply — backed by real Google Cloud services, not a mock.
          </p>
          <ul className="auth-points">
            <li>
              <span className="tick">✓</span>
              Tickets stored durably in Google Cloud Firestore with UTC audit timestamps
            </li>
            <li>
              <span className="tick">✓</span>
              Automated assignment via a Cloud Pub/Sub topic and a triggered Cloud Function
            </li>
            <li>
              <span className="tick">✓</span>
              Role-based access for customers, support agents and admins (Google Identity)
            </li>
            <li>
              <span className="tick">✓</span>
              Live reporting computed from your real ticket data
            </li>
          </ul>
        </div>

        <p className="small" style={{ color: "#7b83a0" }}>
          Built on Google Cloud Platform · Cloud Functions · Firestore · Cloud Pub/Sub ·
          Cloud Logging &amp; Monitoring
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-card card card-pad">
          <div className="auth-logo">
            <span className="brand-mark">S</span> SupportHub
          </div>

          <h2>Sign in</h2>
          <p className="auth-sub">
            Use your Google or Google Workspace account to access the support portal.
          </p>

          {state.status === "checking" && (
            <button className="btn btn-block" disabled>
              <span className="spinner" aria-hidden="true" /> Checking sign-in status…
            </button>
          )}

          {authAvailable && (
            <>
              {/* Official Google GSI button mount point */}
              <div
                ref={googleBtnRef}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  minHeight: 40,
                  marginBottom: 8,
                }}
              />

              <button className="btn btn-primary btn-block" onClick={signIn}>
                <Icon name="google" size={16} />
                Continue with Google
              </button>
              <p className="auth-footnote">
                Authentication is handled by Google Identity Services (OAuth 2.0 / OIDC).
                The Google Cloud backend validates the cryptographic signature of your
                ID token on every request — the interface is never trusted for
                authorization.
              </p>
            </>
          )}

          {state.status === "unavailable" && (
            <>
              <Alert tone="warning" title="Google OAuth Client ID not configured">
                Google Client ID was not detected in <code>VITE_GOOGLE_CLIENT_ID</code>.
                Set your OAuth 2.0 Web Client ID in <code>.env.local</code> to connect to
                your GCP project. No credentials were attempted.
              </Alert>
              <button className="btn btn-primary btn-block" onClick={enterPreviewMode}>
                Preview the interface
              </button>
              <div className="auth-divider">or</div>
              <button
                className="btn btn-block"
                onClick={signIn}
                title="Will fail until VITE_GOOGLE_CLIENT_ID is configured in .env.local"
              >
                Try Google sign-in anyway
              </button>
              <p className="auth-footnote">
                Preview mode shows the interface shell only — it does not simulate sign-in
                and contains <strong>no fabricated ticket data</strong>. Every data screen
                will report the backend as not connected until the Google Cloud APIs are
                deployed.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
