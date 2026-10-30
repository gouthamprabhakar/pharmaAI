"use client";

import { useAuth } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";

type AuthIconName = "building" | "document" | "person" | "help";

const iconPaths: Record<AuthIconName, React.ReactNode> = {
  building: <><path d="M4 21V5l8-3 8 3v16" /><path d="M9 21v-4h6v4M8 8h1m3 0h1m3 0h1M8 12h1m3 0h1m3 0h1" /></>,
  document: <><path d="M6 2h9l4 4v16H6z" /><path d="M15 2v5h5M9 11h7M9 15h7M9 19h5" /></>,
  person: <><circle cx="12" cy="7" r="4" /><path d="M5 22v-2a7 7 0 0 1 14 0v2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.3 1-1.3 1.7v.5M12 17h.01" /></>,
};

function AuthIcon({ name, size = 20 }: { name: AuthIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.52h3.22c1.88-1.73 2.99-4.28 2.99-7.37Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.4l-3.22-2.52c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.13H3.07v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.91A6 6 0 0 1 6.09 12c0-.66.11-1.3.31-1.91v-2.6H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.51l3.33-2.6Z" />
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.33 2.6c.79-2.37 3-4.13 5.6-4.13Z" />
    </svg>
  );
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { longMessage?: unknown; message?: unknown };
    if (typeof candidate.longMessage === "string") return candidate.longMessage;
    if (typeof candidate.message === "string") return candidate.message;
  }
  return "Google sign-in could not be started. Please try again.";
}

export function AuthSignIn() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [startingGoogle, setStartingGoogle] = useState(false);
  const busy = !isAuthLoaded || !isSignInLoaded || startingGoogle || Boolean(isSignedIn);

  useEffect(() => {
    if (isAuthLoaded && isSignedIn) {
      router.replace("/overview");
    }
  }, [isAuthLoaded, isSignedIn, router]);

  const continueWithGoogle = async () => {
    if (!isSignInLoaded || !signIn) return;

    setError("");
    setStatus("");
    setStartingGoogle(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/overview",
        continueSignIn: true,
      });
    } catch (signInError) {
      setError(errorMessage(signInError));
      setStartingGoogle(false);
    }
  };

  return (
    <div className="auth-shell">
      <a className="skip-link" href="#auth-content">Skip to sign in</a>

      <header className="auth-header">
        <Brand />
        <div className="auth-header-meta">
          <span>Manufacturer workspace</span>
          <span className="auth-header-rule" aria-hidden="true" />
          <button type="button" onClick={() => setStatus("Contact your PharmaAI workspace administrator if your Google account has not been approved.")}>
            <AuthIcon name="help" size={17} /> Help
          </button>
        </div>
      </header>

      <main id="auth-content" className="auth-content">
        <section className="auth-context" aria-labelledby="auth-context-heading">
          <div>
            <p className="auth-eyebrow">Evidence. Explanation. Control.</p>
            <h1 id="auth-context-heading">A clearer view of<br />every return, credit<br />and stock variance.</h1>
            <p className="auth-context-copy">One workspace for your finance, commercial,<br />supply-chain and internal audit teams.</p>

            <div className="auth-benefits">
              <article>
                <span className="auth-benefit-icon"><AuthIcon name="building" /></span>
                <div><h2>A workspace for your organization</h2><p>Access is scoped to your manufacturer organization and permitted operational units.</p></div>
              </article>
              <article>
                <span className="auth-benefit-icon"><AuthIcon name="document" /></span>
                <div><h2>Original evidence, always in context</h2><p>Uploaded reports support calculations, record matching and auditable review.</p></div>
              </article>
              <article>
                <span className="auth-benefit-icon"><AuthIcon name="person" /></span>
                <div><h2>People make the final decisions</h2><p>AI suggestions require human review. Financial and inventory actions stay with your team.</p></div>
              </article>
            </div>
          </div>

          <div className="auth-demo-note">
            <span>Development workspace</span>
            <p>No patient-identifiable information is permitted.</p>
          </div>
        </section>

        <section className="auth-panel" aria-labelledby="sign-in-heading">
          <div className="auth-card">
            <p className="auth-eyebrow">Sign in to PharmaAI</p>
            <h2 id="sign-in-heading">Welcome back</h2>
            <p className="auth-panel-copy">Use your approved Google account to access your manufacturer&apos;s reconciliation workspace.</p>

            <button className="auth-google" type="button" disabled={busy} onClick={continueWithGoogle}>
              <GoogleMark /> {busy ? "Opening Google…" : "Continue with Google"}
            </button>

            <div className="auth-expired" role="note">
              <AuthIcon name="person" size={19} />
              <div><strong>Invitation-only access</strong><p>Only invited users can enter this workspace. Permissions are applied after sign-in.</p></div>
            </div>

            {error && <div className="auth-expired" role="alert">
              <AuthIcon name="help" size={19} />
              <div><strong>Sign-in needs attention.</strong><p>{error}</p></div>
            </div>}

            <p className="auth-live-status" role="status" aria-live="polite">{status}</p>
            <p className="auth-legal">By continuing, you agree to the <Link href="/#security">Terms of Service</Link> and <Link href="/#security">Privacy Policy</Link>.<br />Your workspace permissions apply after sign-in.</p>
          </div>
        </section>
      </main>

      <footer className="auth-footer">
        <p>PharmaAI · Manufacturer reconciliation workspace</p>
        <nav aria-label="Legal and support">
          <Link href="/#security">Privacy</Link><Link href="/#security">Terms</Link><button type="button" onClick={() => setStatus("Contact your PharmaAI workspace administrator for access support.")}>Support</button><span>© 2026 PharmaAI</span>
        </nav>
      </footer>
    </div>
  );
}
