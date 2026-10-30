"use client";
import Link from "next/link";
export default function WorkspaceError({ retry }: { error: unknown; retry: () => void }) {
  return <main className="auth-page"><section className="auth-form"><h1>This view could not be loaded</h1><p>Your access may have changed, a required service may be unavailable, or this request may exceed the pilot limits. No successful business action is implied.</p><button className="demo-button primary" onClick={retry}>Try loading again</button><Link className="auth-back" href="/overview">Return to Overview</Link><Link className="auth-back" href="/sign-in">Check workspace sign-in</Link></section></main>;
}
