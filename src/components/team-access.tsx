"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { Role } from "../../convex/lib/permissions";

type InviteRole = Exclude<Role, "owner">;
const roleLabels: Record<InviteRole, string> = { administrator: "Administrator", returns_operations: "Returns reviewer", finance: "Finance", inventory_control: "Sales / inventory reviewer", data_operations: "Data operations", distributor: "Distributor", viewer: "Viewer" };

export function TeamAccess({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requestKey = useRef<string | null>(null);
  const session = useQuery(api.access.session, {});
  const authorized = session?.status === "authorized" && ["owner", "administrator"].includes(session.role);
  const scope = authorized ? { organizationId: session.organizationId } : "skip";
  const context = useQuery(api.access.context, scope);
  const team = useQuery(api.invitations.team, scope);
  const prepare = useMutation(api.access.prepareInvitation);
  const deliver = useMutation(api.invitations.requestDelivery);
  const revoke = useMutation(api.access.revokeInvitation);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("viewer");
  const [units, setUnits] = useState<Id<"operationalUnits">[]>([]);
  const [distributor, setDistributor] = useState<Id<"distributors"> | "">("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => { node?.close(); previous?.focus(); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!authorized) return;
    setBusy(true); setMessage("");
    requestKey.current ??= crypto.randomUUID();
    try {
      const invitation = await prepare({ organizationId: session.organizationId, email, role, operationalUnitIds: units, distributorId: role === "distributor" && distributor ? distributor : undefined, idempotencyKey: requestKey.current });
      const result = await deliver({ organizationId: session.organizationId, invitationId: invitation.invitationId as Id<"invitations"> });
      setMessage(result.delivery === "not_configured" ? "Invitation prepared. Sending is not configured yet." : `Invitation ${result.delivery}. Check delivery status below.`);
      setEmail(""); requestKey.current = null;
    } catch { setMessage("The invitation could not be completed. Check the details and any existing invitation for that email, then try again."); }
    finally { setBusy(false); }
  }
  async function revokeInvite(id: Id<"invitations">) {
    if (!authorized || reason.trim().length < 3) { setMessage("Enter a reason before revoking an invitation."); return; }
    setBusy(true);
    try { await revoke({ organizationId: session.organizationId, invitationId: id, reason }); setMessage("Workspace invitation revoked. Any provider cancellation will be shown in its delivery status."); }
    catch { setMessage("The invitation could not be revoked. Refresh and check your permissions."); }
    finally { setBusy(false); }
  }
  async function checkDelivery(id: Id<"invitations">) {
    if (!authorized) return;
    setBusy(true);
    try { const result = await deliver({ organizationId: session.organizationId, invitationId: id }); setMessage(`Invitation delivery: ${result.delivery}. An uncertain attempt is checked without resending.`); }
    catch { setMessage("Delivery could not be checked. Refresh and try again."); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="team-dialog" aria-labelledby="team-title" onCancel={onClose}>
    <header className="team-dialog-header"><h2 id="team-title">Team &amp; access</h2><button className="demo-button" onClick={onClose} type="button">Close</button></header>
    {!authorized ? <p>Only an authorized workspace owner or administrator can manage team access.</p> : <>
      <p>Invite people with only the role and operational units they need.</p>
      <form onSubmit={submit} className="team-invite-form">
        <label>Email address<input type="email" required maxLength={254} value={email} disabled={busy} onChange={(e) => { setEmail(e.target.value); requestKey.current = null; }} /></label>
        <label>Role<select value={role} disabled={busy} onChange={(e) => { setRole(e.target.value as InviteRole); requestKey.current = null; }}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <fieldset><legend>Permitted operational units</legend>{context?.units.map((unit) => <label className="team-unit-choice" key={unit.id}><input type="checkbox" disabled={busy} checked={units.includes(unit.id)} onChange={(e) => { setUnits(e.target.checked ? [...units, unit.id] : units.filter((id) => id !== unit.id)); requestKey.current = null; }} />{unit.name}</label>)}{context?.units.length === 0 && <p>Configure an operational unit before granting unit access.</p>}</fieldset>
        {role === "distributor" && <label>Distributor<select required value={distributor} disabled={busy} onChange={(e) => { setDistributor(e.target.value as Id<"distributors">); requestKey.current = null; }}><option value="">Choose distributor</option>{context?.distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
        <button className="demo-button primary" disabled={busy || !context} type="submit">{busy ? "Working…" : "Send invitation"}</button>
      </form>
      <h3>Members</h3><div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{team?.members.map((m) => <tr key={m.id}><td>{m.displayName}</td><td>{m.email}</td><td>{m.role === "owner" ? "Owner" : roleLabels[m.role]}</td><td>{m.active ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div>
      <h3>Invitations</h3><label className="team-revoke-reason">Reason for revoking<input value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="table-scroll"><table><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Delivery</th><th>Action</th></tr></thead><tbody>{team?.invitations.map((i) => <tr key={i.id}><td>{i.email}</td><td>{roleLabels[i.role]}</td><td>{i.status}</td><td>{i.delivery === "sent" ? "Sent for delivery" : i.delivery}</td><td>{i.status === "prepared" && <><button className="demo-button" type="button" disabled={busy} onClick={() => void revokeInvite(i.id)}>Revoke</button>{["not_sent", "unknown", "blocked"].includes(i.delivery) && <button className="demo-button" type="button" disabled={busy} onClick={() => void checkDelivery(i.id)}>{i.delivery === "not_sent" ? "Send" : "Check / retry"}</button>}</>}</td></tr>)}</tbody></table></div>
      {team?.invitations.length === 0 && <p>No workspace invitations yet.</p>}
    </>}
    <p role="status" aria-live="polite">{message}</p>
  </dialog>;
}
