"use client";

import { useMutation, useQuery } from "convex/react";
import { useRef, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { BusinessFilters } from "./returns-workspace";
import { inr } from "@/lib/format-values";
import { rupeesToPaise } from "../../convex/lib/exact";
import Link from "next/link";
import type { FunctionReturnType } from "convex/server";

export function CreditLedger({ organizationId, filters }: { organizationId: Id<"organizations">; filters: BusinessFilters }) {
  const session = useQuery(api.access.session, {}); const canCredit = session?.status === "authorized" && ["owner", "administrator", "finance"].includes(session.role);
  const rows = useQuery(api.credits.list, { organizationId, operationalUnitId: filters.operationalUnitId, distributorId: filters.distributorId }); const [selected, setSelected] = useState<Id<"creditNotes"> | null>(null);
  const confirm = useMutation(api.credits.confirmNoteTotal); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const key = useRef<string | null>(null);
  const item = rows?.find((r) => r.note._id === selected);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!item) return; const f = new FormData(event.currentTarget); key.current ??= crypto.randomUUID(); setBusy(true); try { await confirm({ noteId: item.note._id, totalPaise: rupeesToPaise(String(f.get("total"))), issuedConfirmed: f.has("issued"), reason: String(f.get("reason")), idempotencyKey: key.current }); key.current = null; setMessage("Issued note total confirmed. Case matching will update from this recorded evidence."); } catch { setMessage("The note could not be confirmed. Check its allocations, actual issued total and your Finance access."); } finally { setBusy(false); } }
  return <section className="data-card intake-review"><h2>Issued credit evidence</h2><p>Imported allocations wait for Finance to confirm the actual issued note total. Approval alone is not recorded as issuance.</p><div className="table-scroll"><table><thead><tr><th>Credit note</th><th>Distributor</th><th>Issued date</th><th>Confirmed total</th><th>Allocated</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows?.filter((r) => (!filters.periodStart || r.note.issuedDate >= filters.periodStart) && (!filters.periodEnd || r.note.issuedDate <= filters.periodEnd)).map((r) => <tr key={r.note._id}><td>{r.note.number}</td><td>{r.distributorName}</td><td>{r.note.issuedDate}</td><td>{inr(r.note.confirmedTotalPaise)}</td><td>{inr(r.allocatedPaise)}</td><td>{r.pending ? "Finance confirmation needed" : "Confirmed issued evidence"}</td><td><button className="demo-button" onClick={() => { setSelected(r.note._id); key.current = null; setMessage(""); }}>Open note</button></td></tr>)}</tbody></table></div>{rows?.length === 0 && <p>No credit notes recorded yet.</p>}
    {item && <><h3>{item.note.number}</h3><ul>{item.allocations.map((a) => <li key={a._id}><Link href={`/returns/${a.caseId}`}>{a.caseReference}</Link> · {inr(a.amountPaise)} · {a.matchRequired ? "Return line match required" : "Allocation linked"}{canCredit && a.matchRequired && <CreditAllocationMatch allocation={a}/>}</li>)}</ul>{canCredit && <form className="configuration-form" onSubmit={(e) => void submit(e)} onChange={() => { key.current = null; }}><label>Actual issued note total (INR)<input name="total" required/></label><label className="team-unit-choice"><input type="checkbox" name="issued" required/>I confirm this credit note was actually issued in the finance system.</label><label>Confirmation reason<input name="reason" required minLength={3} maxLength={1000}/></label><button type="submit" disabled={busy} className="demo-button primary">Confirm issued note</button></form>}
    </>}<p role="status">{message}</p>
  </section>;
}
function CreditAllocationMatch({ allocation }: { allocation: FunctionReturnType<typeof api.credits.list>[number]["allocations"][number] }) {
  const detail = useQuery(api.returns.detail, { caseId: allocation.caseId }); const correct = useMutation(api.credits.correctAllocation); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const key = useRef<string | null>(null);
  if (!detail || detail.restricted) return null;
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); key.current ??= crypto.randomUUID(); setBusy(true); try { await correct({ lineId: allocation._id, caseId: allocation.caseId, amountPaise: allocation.amountPaise, quantities: [{ returnLineId: String(f.get("returnLine")) as Id<"returnLines">, quantity: String(f.get("quantity")) }], reason: String(f.get("reason")), idempotencyKey: key.current }); setMessage("Match saved. Confirm the note total to adopt the correction."); } catch { setMessage("The match could not be saved. Check the product, quantity and your access."); } finally { setBusy(false); } }
  return <form className="configuration-form" onSubmit={(e) => void submit(e)} onChange={() => { key.current = null; }}><label>Returned product and batch<select name="returnLine" required><option value="">Choose the matching return line</option>{detail.lines.map((line) => <option key={line._id} value={line._id}>{detail.products.find((p) => p.lineId === line._id)?.name} · {line.batchNumber} · invoice {line.invoiceNumber}</option>)}</select></label><label>Credited quantity<input name="quantity" required/></label><label>Match reason<input name="reason" required minLength={3}/></label><button type="submit" className="demo-button" disabled={busy}>Confirm allocation match</button><p role="status">{message}</p></form>;
}
