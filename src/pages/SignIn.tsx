import { useAuth } from "../lib/auth";
import { Icon } from "../components/icons";
import { Alert } from "../components/ui";

/**
 * Sign-in screen. In production this redirects to Microsoft Entra ID through
 * Static Web Apps Easy Auth (/.auth/login/aad). It never accepts or stores a
 * password itself — hardcoded demo passwords are explicitly forbidden.
 */
export function SignIn() {
  const { state, signIn, enterPreviewMode } = useAuth();
  const authAvailable = state.status === "anonymous" || state.status === "authenticated";

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
            follow every reply — backed by real Azure services, not a mock.
          </p>
          <ul className="auth-points">
            <li>
              <span className="tick">✓</span>
              Tickets stored durably in Azure Cosmos DB with UTC audit timestamps
            </li>
            <li>
              <span className="tick">✓</span>
              Automated assignment via a Service Bus queue and a triggered Function
            </li>
            <li>
              <span className="tick">✓</span>
              Role-based access for customers, support agents and admins (Entra ID)
            </li>
            <li>
              <span className="tick">✓</span>
              Live reporting computed from your real ticket data
            </li>
          </ul>
        </div>

        <p className="small" style={{ color: "#7b83a0" }}>
          Built on Azure Static Web Apps · Functions · Cosmos DB · Service Bus ·
          Application Insights
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-card card card-pad">
          <div className="auth-logo">
            <span className="brand-mark">S</span> SupportHub
          </div>

          <h2>Sign in</h2>
          <p className="auth-sub">
            Use your work or school account to access the support portal.
          </p>

          {state.status === "checking" && (
            <button className="btn btn-block" disabled>
              <span className="spinner" aria-hidden="true" /> Checking sign-in status…
            </button>
          )}

          {authAvailable && (
            <>
              <button className="btn btn-primary btn-block" onClick={signIn}>
                <Icon name="shield" size={16} />
                Continue with Microsoft
              </button>
              <p className="auth-footnote">
                Authentication is handled by Microsoft Entra ID via Azure Static Web Apps
                Easy Auth. The backend re-checks your identity and role on every request —
                the interface is never trusted for authorization.
              </p>
            </>
          )}

          {state.status === "unavailable" && (
            <>
              <Alert tone="warning" title="Sign-in service not reachable">
                Easy Auth was not detected at <code>/.auth/me</code>. This happens when
                the app runs locally or before Azure Static Web Apps authentication is
                configured. No credentials were attempted.
              </Alert>
              <button className="btn btn-primary btn-block" onClick={enterPreviewMode}>
                Preview the interface
              </button>
              <div className="auth-divider">or</div>
              <button
                className="btn btn-block"
                onClick={signIn}
                title="Will fail until Easy Auth is configured on the Static Web App"
              >
                Try Microsoft sign-in anyway
              </button>
              <p className="auth-footnote">
                Preview mode shows the interface shell only — it does not simulate sign-in
                and contains <strong>no fabricated ticket data</strong>. Every data screen
                will report the backend as not connected until the Azure APIs are
                deployed.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
