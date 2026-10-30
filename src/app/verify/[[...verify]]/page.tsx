import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/components/brand";

// Clerk resumes the existing OAuth attempt here, including TOTP or recovery-code
// verification. This route never reads company data or grants membership.
export default function VerificationPage() {
  return <main style={{ display: "grid", justifyItems: "center", gap: 24, padding: "24px 16px" }}>
    <Brand />
    <h1>Complete account verification</h1>
    <Suspense fallback={<p role="status">Loading verification…</p>}>
      <SignIn path="/verify" routing="path" forceRedirectUrl="/overview" withSignUp={false} transferable={false} />
    </Suspense>
    <Link href="/sign-in">Back to Google sign-in</Link>
  </main>;
}
