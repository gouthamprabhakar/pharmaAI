import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Brand } from "@/components/brand";

export default async function AccountPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) redirect("/sign-in");
  await auth.protect();
  return <main style={{ display: "grid", justifyItems: "center", gap: 24, padding: "24px 16px" }}>
    <header style={{ width: "100%", maxWidth: 880, display: "flex", justifyContent: "space-between", alignItems: "center" }}><Brand/><Link href="/overview">Back to workspace</Link></header>
    <section style={{ width: "100%", maxWidth: 880 }}><h1>Account security</h1><p>Open Security, then Two-step verification to add your authenticator app. Save recovery codes privately. After enrollment, sign out and sign in again to verify your second factor.</p></section>
    <Suspense fallback={<p role="status">Loading account security…</p>}><UserProfile path="/account" routing="path" /></Suspense>
  </main>;
}
