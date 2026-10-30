"use client";

import { useOrganizationList } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function WorkspaceAccess({ status }: { status?: string }) {
  const router = useRouter();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({ userMemberships: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { isAuthenticated } = useConvexAuth();
  const invitations = useQuery(api.access.pendingInvitations, isAuthenticated ? {} : "skip");
  const accept = useMutation(api.access.acceptInvitation);
  async function acceptInvitation(invitationId: Id<"invitations">) {
    setBusy(true); setError("");
    try { await accept({ invitationId }); router.replace("/overview"); router.refresh(); }
    catch { setBusy(false); setError("The invitation could not be accepted. Select its workspace first, then check that your invited Google account is signed in."); }
  }
  async function selectOrganization(id: string) {
    if (!setActive) return;
    setBusy(true);
    setError("");
    try {
      await setActive({ organization: id });
      router.replace("/overview");
      router.refresh();
    } catch {
      setBusy(false);
      setError("The workspace could not be opened. Refresh and try again.");
    }
  }
  return <div style={{ display: "grid", gap: 16, margin: "20px 0" }}>
    <p className="auth-description">{status === "mfa_required" ? "Verify your account with an authenticator app before entering as an owner or administrator." : "Choose a manufacturer workspace you already belong to. Your assigned role and permitted units apply after selection."}</p>
    {status === "organization_required" && isLoaded && userMemberships.data?.map((membership) => <button className="demo-button primary" type="button" key={membership.id} disabled={busy} onClick={() => void selectOrganization(membership.organization.id)}>Open {membership.organization.name}</button>)}
    {status === "organization_required" && isLoaded && userMemberships.data?.length === 0 && <p>No workspace membership is available yet. Contact your workspace administrator.</p>}
    {invitations?.map((invite) => <section key={invite.id}><h2>Invitation to {invite.organizationName}</h2><p>Role: {invite.role.replaceAll("_", " ")} · {invite.permittedUnitCount} permitted units</p><button type="button" className="demo-button primary" disabled={busy} onClick={() => void acceptInvitation(invite.id)}>Accept workspace invitation</button></section>)}
    <Link className="demo-button" href="/account/security">Manage account security</Link>
    {error && <p role="alert">{error}</p>}
  </div>;
}
