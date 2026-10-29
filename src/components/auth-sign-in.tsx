"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Brand } from "@/components/brand";

type AuthIconName = "building" | "document" | "person" | "help" | "clock" | "refresh";

const iconPaths: Record<AuthIconName, React.ReactNode> = {
  building: <><path d="M4 21V5l8-3 8 3v16" /><path d="M9 21v-4h6v4M8 8h1m3 0h1m3 0h1M8 12h1m3 0h1m3 0h1" /></>,
  document: <><path d="M6 2h9l4 4v16H6z" /><path d="M15 2v5h5M9 11h7M9 15h7M9 19h5" /></>,
  person: <><circle cx="12" cy="7" r="4" /><path d="M5 22v-2a7 7 0 0 1 14 0v2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.3 1-1.3 1.7v.5M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  refresh: <><path d="M19 7v4h-4M5 17v-4h4" /><path d="M7.1 8.2A7 7 0 0 1 19 11M5 13a7 7 0 0 0 11.9 2.8" /></>,
};

function AuthIcon({ name, size = 20 }: { name: AuthIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  );
}

const codeDigits = ["1", "6", "2", "8", "5", "0"];

export function AuthSignIn() {
  const [status, setStatus] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  const demoMessage =
    "Authentication is not connected yet. No sign-in code has been sent and no account has been created.";

  return (
    <div className="auth-shell">
      <a className="skip-link" href="#auth-content">Skip to sign in</a>

      <header className="auth-header">
        <Brand />
        <div className="auth-header-meta">
          <span>Manufacturer workspace</span>
          <span className="auth-header-rule" aria-hidden="true" />
          <button type="button" onClick={() => setStatus("Help is a UI preview and is not connected to a support service yet.")}>
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
            <span>Fictional demo screen</span>
            <p>No patient-identifiable information is permitted.</p>
          </div>
        </section>

        <section className="auth-panel" aria-labelledby="sign-in-heading">
          <div className="auth-card">
            <p className="auth-eyebrow">Sign in to PharmaAI</p>
            <h2 id="sign-in-heading">Welcome back</h2>
            <p className="auth-panel-copy">Access your manufacturer&apos;s reconciliation workspace.<br />No password required.</p>

            <button className="auth-google" type="button" onClick={() => setStatus(demoMessage)}>
              <span aria-hidden="true">G</span> Continue with Google
            </button>

            <div className="auth-divider"><span>or continue with an email one-time code</span></div>

            <form onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="auth-email">Email address</label>
              <div className="auth-email-control">
                <input ref={emailRef} id="auth-email" name="email" type="email" defaultValue="analyst@asterion.example" aria-describedby="email-note auth-live-status" />
                <button type="button" onClick={() => emailRef.current?.select()}>Change</button>
              </div>
              <p id="email-note" className="auth-field-note">Fictional demo account · Use the email invited to your workspace.</p>

              <fieldset className="auth-code-fieldset">
                <div className="auth-code-heading">
                  <legend>Enter your one-time code</legend>
                  <span><AuthIcon name="clock" size={14} /> Code expired</span>
                </div>
                <div className="auth-code-inputs">
                  {codeDigits.map((digit, index) => (
                    <input key={index} aria-label={`Digit ${index + 1} of verification code`} inputMode="numeric" maxLength={1} defaultValue={digit} />
                  ))}
                </div>
              </fieldset>

              <div className="auth-expired" role="alert">
                <AuthIcon name="clock" size={19} />
                <div><strong>This code has expired.</strong><p>Request a new code, then enter the latest code from your email.</p></div>
              </div>

              <button className="auth-resend" type="button" onClick={() => setStatus(demoMessage)}>
                <AuthIcon name="refresh" size={18} /> Resend code
              </button>

              <div className="auth-form-links">
                <button type="button" onClick={() => emailRef.current?.select()}>Use a different email</button>
                <button type="button" onClick={() => setStatus("Troubleshooting is a UI preview and is not connected to a support service yet.")}>Trouble signing in? <AuthIcon name="help" size={14} /></button>
              </div>

              <p id="auth-live-status" className="auth-live-status" role="status" aria-live="polite">{status}</p>
            </form>

            <p className="auth-legal">By continuing, you agree to the <Link href="/#security">Terms of Service</Link> and <Link href="/#security">Privacy Policy</Link>.<br />Your workspace permissions apply after sign-in.</p>
          </div>
        </section>
      </main>

      <footer className="auth-footer">
        <p>PharmaAI · Manufacturer reconciliation workspace</p>
        <nav aria-label="Legal and support">
          <Link href="/#security">Privacy</Link><Link href="/#security">Terms</Link><button type="button" onClick={() => setStatus("Support is not connected in this UI preview.")}>Support</button><span>© 2026 PharmaAI</span>
        </nav>
      </footer>
    </div>
  );
}
