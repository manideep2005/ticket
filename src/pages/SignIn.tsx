import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { Icon } from "../components/icons";
import { Alert } from "../components/ui";

const RETURNING_USER_KEY = "supporthub_returning_user";

function isReturningUser(): boolean {
  try { return localStorage.getItem(RETURNING_USER_KEY) === "true"; } catch { return false; }
}
function markReturningUser() {
  try { localStorage.setItem(RETURNING_USER_KEY, "true"); } catch { /* ignore */ }
}

const FEATURES = [
  {
    icon: "🎫",
    title: "Smart Ticket Management",
    desc: "Submit, track and resolve support tickets — automatically routed to the right team.",
  },
  {
    icon: "🤖",
    title: "AI-Powered Triage",
    desc: "Every ticket is instantly categorized, prioritized and assigned using heuristic AI.",
  },
  {
    icon: "⏱️",
    title: "SLA Tracking",
    desc: "Real-time SLA burn-down so no ticket ever breaches its deadline unnoticed.",
  },
  {
    icon: "☁️",
    title: "Built on Google Cloud",
    desc: "Powered by Cloud Run, Firestore and Cloud Pub/Sub — scalable and always on.",
  },
];

function AnimatedHero() {
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveFeature((i) => (i + 1) % FEATURES.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="auth-hero auth-hero-animated">
      {/* Background orbs */}
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      {/* Brand */}
      <div className="hero-brand">
        <span className="brand-mark">S</span>
        <strong>SupportHub</strong>
      </div>

      {/* Main copy */}
      <div className="hero-copy">
        <h1 className="hero-headline">
          Customer support,<br />
          <span className="hero-headline-accent">powered by the cloud.</span>
        </h1>
        <p className="hero-tagline">
          A unified platform for customers, support agents and admins — with AI triage,
          SLA tracking and real-time routing built in.
        </p>
      </div>

      {/* Animated feature cards */}
      <div className="hero-features">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className={`hero-feature-card ${i === activeFeature ? "hero-feature-active" : ""}`}
          >
            <span className="hero-feature-icon">{f.icon}</span>
            <div>
              <div className="hero-feature-title">{f.title}</div>
              <div className="hero-feature-desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress dots */}
      <div className="hero-dots">
        {FEATURES.map((_, i) => (
          <button
            key={i}
            className={`hero-dot ${i === activeFeature ? "active" : ""}`}
            onClick={() => setActiveFeature(i)}
            aria-label={`Feature ${i + 1}`}
          />
        ))}
      </div>

      {/* Footer */}
      <p className="hero-footer-note">
        Trusted by support teams · Backed by Google Cloud Platform
      </p>
    </section>
  );
}

/* ─── Main SignIn page ────────────────────────────────────────── */
export function SignIn() {
  const { state, signIn, enterPreviewMode, googleClientId, handleCredentialResponse } =
    useAuth();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [gsiRendered, setGsiRendered] = useState(false);
  const [isSignUp, setIsSignUp] = useState(() => !isReturningUser());
  const authAvailable = state.status === "anonymous" || state.status === "authenticated";

  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current || !window.google?.accounts?.id) return;
    try {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "filled_blue",
        size: "large",
        text: isSignUp ? "signup_with" : "signin_with",
        shape: "rectangular",
        width: 320,
      });
      setGsiRendered(true);
    } catch {
      setGsiRendered(false);
    }
  }, [googleClientId, handleCredentialResponse, authAvailable, isSignUp]);

  function handleSignIn() { markReturningUser(); signIn(); }
  function switchToSignIn() { markReturningUser(); setIsSignUp(false); }
  function switchToSignUp() { setIsSignUp(true); }

  return (
    <div className="auth-screen">
      <AnimatedHero />

      <section className="auth-panel">
        <div className="auth-card card card-pad">
          <div className="auth-logo">
            <span className="brand-mark">S</span> SupportHub
          </div>

          <div className="auth-mode-tabs">
            <button className={`auth-mode-tab ${isSignUp ? "active" : ""}`} onClick={switchToSignUp}>
              Create account
            </button>
            <button className={`auth-mode-tab ${!isSignUp ? "active" : ""}`} onClick={switchToSignIn}>
              Sign in
            </button>
          </div>

          <h2>{isSignUp ? "Get started" : "Welcome back"}</h2>
          <p className="auth-sub">
            {isSignUp
              ? "Create your SupportHub account using your Google or Google Workspace account."
              : "Sign in to your SupportHub account to view tickets and manage support."}
          </p>

          {state.status === "checking" && (
            <button className="btn btn-block" disabled>
              <span className="spinner" aria-hidden="true" /> Checking sign-in status…
            </button>
          )}

          {authAvailable && (
            <>
              <div ref={googleBtnRef} style={{ display: "flex", justifyContent: "center", minHeight: 40, marginBottom: 8 }} />
              {!gsiRendered && (
                <button className="btn btn-primary btn-block" onClick={handleSignIn}>
                  <Icon name="google" size={16} />
                  {isSignUp ? "Sign up with Google" : "Sign in with Google"}
                </button>
              )}
              <p className="auth-switch-text">
                {isSignUp ? (
                  <>Already have an account?{" "}<button className="auth-switch-link" onClick={switchToSignIn}>Sign in</button></>
                ) : (
                  <>New to SupportHub?{" "}<button className="auth-switch-link" onClick={switchToSignUp}>Create an account</button></>
                )}
              </p>
              <p className="auth-footnote">
                Authentication is handled by Google Identity Services (OAuth 2.0 / OIDC).
                The Google Cloud backend validates the cryptographic signature of your
                ID token on every request — the interface is never trusted for authorization.
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
              <button className="btn btn-block" onClick={signIn} title="Will fail until VITE_GOOGLE_CLIENT_ID is configured">
                Try Google sign-in anyway
              </button>
              <p className="auth-footnote">
                Preview mode shows the interface shell only — it does not simulate sign-in
                and contains <strong>no fabricated ticket data</strong>.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
