"use client";

import { useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { allowedIntakeTypes } from "../../convex/lib/intakePermissions";

export const evidenceLabels = { manufacturer_sales_shipments: "Manufacturer sales & shipment data", distributor_return_claim: "Distributor return claim", distributor_sales_stock: "Distributor sales & stock report", issued_credit_notes: "Issued credit notes" } as const;
type EvidenceType = keyof typeof evidenceLabels;
const labels = (value: string) => value === "accepted" ? "confirmed" : value.replaceAll("_", " ");
const jobError = (value?: string) => value === "PERMISSION_CHANGED" ? "Processing stopped because access changed. An authorized person must resume it." : value === "SOURCE_CONFLICT" ? "This evidence conflicts with an existing source. Submit it as an explicit correction to that accepted file." : value ? `Processing needs attention: ${labels(value).toLowerCase()}.` : "";

export function DataIntake({ tab }: { tab: string }) {
  const searchParams = useSearchParams();
  const session = useQuery(api.access.session, {});
  const scope = session?.status === "authorized" ? { organizationId: session.organizationId } : "skip";
  const context = useQuery(api.access.context, scope);
  const history = useQuery(api.intake.history, scope);
  const [unit, setUnit] = useState<Id<"operationalUnits"> | "">("");
  const [type, setType] = useState<EvidenceType | "">(() => (searchParams.get("type") ?? "") in evidenceLabels ? searchParams.get("type") as EvidenceType : "");
  const allowed = session?.status === "authorized" ? allowedIntakeTypes(session.role) : [];
  const currentType = type && allowed.includes(type) ? type : "";
  const linkedDistributorUnit = session?.status === "authorized" && session.role === "distributor" && context?.units.length === 1 ? context.units[0].id : "";
  const currentUnit = unit || linkedDistributorUnit;
  const [selected, setSelected] = useState<Id<"submissions"> | null>(null);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("");
  const [file, setFile] = useState<File | null>(null); const requestKey = useRef<string | null>(null);
  const upload = useMutation(api.intake.requestUpload); const complete = useMutation(api.intake.completeUpload); const download = useAction(api.intakeJobs.downloadStandardTemplate);
  if (session?.status !== "authorized" || !context) return <p role="status">Loading permitted intake options…</p>;
  const authorizedSession = session;
  const permittedUnits = context.units;
  const confirmedHistory = history?.filter((submission) => ["accepted", "replaced"].includes(submission.status));
  async function resolveDepot(selectedFile: File) {
    const form = new FormData(); form.append("file", selectedFile);
    const response = await fetch("/api/intake/detect-depot", { method: "POST", body: form });
    if (!response.ok) throw new Error("DEPOT_NOT_DETECTED");
    const { unitName } = await response.json() as { unitName?: string };
    if (!unitName) throw new Error("DEPOT_NOT_DETECTED");
    const match = permittedUnits.find((item) => item.name.trim().toLocaleLowerCase("en-IN") === unitName.toLocaleLowerCase("en-IN"));
    if (!match) throw new Error("DEPOT_NOT_DETECTED");
    return match;
  }
  async function detectDepot(selectedFile: File) {
    const match = await resolveDepot(selectedFile);
    setUnit(match.id);
    setMessage("File ready.");
    return match.id;
  }
  async function chooseFile(selectedFile: File | null) {
    setFile(selectedFile); requestKey.current = null;
    if (!selectedFile || !currentType || currentType === "manufacturer_sales_shipments" || authorizedSession.role === "distributor") return;
    setUnit(""); setMessage("Reading the depot from the uploaded file…");
    try { await detectDepot(selectedFile); } catch { setMessage("The depot could not be matched from unit_name in the file."); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session?.status !== "authorized" || !currentType || !file) { setMessage("Choose the upload type and file."); return; }
    requestKey.current ??= crypto.randomUUID(); setBusy(true); setMessage("Uploading the selected file…");
    try {
      let uploadUnit = currentUnit;
      if (!uploadUnit && currentType !== "manufacturer_sales_shipments" && session.role !== "distributor") { setMessage("Reading the depot from the uploaded file…"); uploadUnit = await detectDepot(file); }
      if (!uploadUnit) { setMessage(currentType === "manufacturer_sales_shipments" ? "Choose the depot and file." : "The depot could not be matched from unit_name in the file."); return; }
      const intent = await upload({ organizationId: session.organizationId, operationalUnitId: uploadUnit as Id<"operationalUnits">, evidenceType: currentType, fileName: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size, noPatientData: true, idempotencyKey: requestKey.current });
      let id = intent.submissionId;
      if (!id && intent.uploadUrl) { const response = await fetch(intent.uploadUrl, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file }); if (!response.ok) throw new Error("UPLOAD_FAILED"); const result = await response.json() as { storageId: Id<"_storage"> }; id = await complete({ intentId: intent.intentId, storageId: result.storageId }); }
      if (!id) throw new Error("UPLOAD_NOT_CONFIRMED"); setSelected(id); requestKey.current = null; setMessage("Upload stored and structural validation started. Human confirmation remains a separate action.");
    } catch (error) { setMessage(error instanceof Error && error.message === "DEPOT_NOT_DETECTED" ? "The depot could not be matched from unit_name in the file." : "Upload was not confirmed. Check required fields, the applicable template and your access, then retry. Existing file copies are detected by checksum."); }
    finally { setBusy(false); }
  }
  async function saveTemplate(evidenceType: EvidenceType, format: "csv" | "xlsx") { setBusy(true); try { const result = await download({ organizationId: authorizedSession.organizationId, evidenceType, format }); const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: result.contentType })); const a = document.createElement("a"); a.href = url; a.download = result.fileName; a.click(); URL.revokeObjectURL(url); setMessage("Template downloaded. Add your records to the Data sheet and keep the listed version."); } catch { setMessage("Template could not be downloaded. Check your access and retry."); } finally { setBusy(false); } }
  const depotLocked = currentType !== "manufacturer_sales_shipments";
  const intakeUnitChoice = session.role === "distributor" ? null : <label className={`depot-field${depotLocked ? " is-locked" : ""}`}>Depot<div className="depot-select-control"><select value={depotLocked ? "" : unit} required={!depotLocked} disabled={busy || depotLocked} onChange={(e) => { setUnit(e.target.value as Id<"operationalUnits">); requestKey.current = null; }}><option value="">{depotLocked ? "" : "Choose depot"}</option>{context.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>{depotLocked && <span className="depot-lock-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M7 10V7a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z"/></svg></span>}</div></label>;
  return <>
    <div className="workspace-content-grid"><section className="data-card form-card">
      {tab === "New intake" && <><h2>Upload a file</h2>{allowed.length === 0 ? <p>Your role cannot upload these records. Receipt evidence is added inside the return case by an authorized reviewer.</p> : <form id="intake-form" onSubmit={(e) => void submit(e)} onChange={() => { requestKey.current = null; }}>
        <fieldset disabled={busy} className="intake-fields"><label>Upload type<select value={currentType} required onChange={(e) => { const next = e.target.value as EvidenceType | ""; setType(next); setUnit(""); setMessage(""); requestKey.current = null; if (file && next && next !== "manufacturer_sales_shipments" && authorizedSession.role !== "distributor") void detectDepot(file).catch(() => setMessage("The depot could not be matched from unit_name in the file.")); }}><option value="">Select what you’re uploading</option>{allowed.map((value) => <option value={value} key={value}>{evidenceLabels[value as EvidenceType]}</option>)}</select></label>{intakeUnitChoice}
        <label className="upload-zone wide">Choose an XLSX or CSV file<input type="file" accept=".xlsx,.csv" required onChange={(e) => void chooseFile(e.target.files?.[0] ?? null)}/><span>Up to 5 MiB and 1,000 records. No formulas or patient information.</span></label>
        <p className="wide">By uploading, you confirm the file contains no patient-identifiable information. Template version, distributor codes and reporting dates will be read from the file.</p>
        <button type="submit" className="demo-button primary">{busy ? "Uploading…" : "Upload and validate"}</button></fieldset>
      </form>}</>}
      {tab === "Templates" && <><h2>Standard templates</h2><p>Download the required format, add your records to its Data sheet, and upload it through New intake. These templates apply across all depots.</p><div className="table-scroll"><table><thead><tr><th>Template</th><th>Version</th><th>Download</th></tr></thead><tbody>{(Object.keys(evidenceLabels) as EvidenceType[]).map((evidenceType) => <tr key={evidenceType}><td>{evidenceLabels[evidenceType]}</td><td>1</td><td><button type="button" className="demo-button" disabled={busy} onClick={() => void saveTemplate(evidenceType, "xlsx")}>Excel</button><button type="button" className="demo-button" disabled={busy} onClick={() => void saveTemplate(evidenceType, "csv")}>CSV</button></td></tr>)}</tbody></table></div></>}
      {tab === "Submission history" && <><div className="data-toolbar"><label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search confirmed submissions…"/></label><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["accepted", "replaced"].map((s) => <option key={s} value={s}>{labels(s)}</option>)}</select></label></div><div className="table-scroll"><table><thead><tr><th>File</th><th>Evidence type</th><th>Upload date</th><th>Status</th><th>Action</th></tr></thead><tbody>{confirmedHistory?.filter((s) => (!status || s.status === status) && `${s.fileName} ${s.evidenceType}`.toLowerCase().includes(search.toLowerCase())).map((s) => <tr key={s._id}><td>{s.fileName}</td><td>{evidenceLabels[s.evidenceType]}</td><td>{new Date(s.createdAt).toLocaleDateString()}</td><td>{labels(s.status)}</td><td><button className="demo-button" onClick={() => setSelected(s._id)}>Open</button></td></tr>)}</tbody></table></div>{confirmedHistory?.length === 0 && <p>No confirmed submissions yet.</p>}</>}
      <p role="status" aria-live="polite">{message}</p>
    </section><aside className="detail-panel"><h2>Validation checks</h2><p>Controlled template and required fields</p><p>File type, size and structure</p><p>Dates, exact numbers and known codes</p><p>Possible duplicates and internal totals</p><p>Original evidence and corrections retained</p><hr/><p>Validation makes data usable. Human confirmation accepts evidence; it does not approve returns or issue credits.</p></aside></div>
    {selected && <SubmissionReview key={selected} id={selected} onClose={() => setSelected(null)} onConfirmed={() => { setSelected(null); setFile(null); setType(""); setUnit(""); setMessage("Upload complete."); }}/>}
  </>;
}

function SubmissionReview({ id, onClose, onConfirmed }: { id: Id<"submissions">; onClose: () => void; onConfirmed: () => void }) {
  const data = useQuery(api.intake.detail, { submissionId: id }); const retry = useMutation(api.intake.retry); const revalidate = useMutation(api.intake.revalidate); const confirm = useMutation(api.intake.confirm); const discard = useMutation(api.intake.discard); const cancel = useMutation(api.intake.cancelConfirmation); const linkWorkflow = useMutation(api.projections.retry);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const key = useRef<string | null>(null);
  const [record, setRecord] = useState<number | null>(null); const completionHandled = useRef(false);
  useEffect(() => { if (data?.submission.status === "accepted" && !completionHandled.current) { completionHandled.current = true; onConfirmed(); } }, [data?.submission.status, onConfirmed]);
  if (!data) return <p role="status">Loading submission…</p>;
  const ready = data.canWrite && ["ready_for_confirmation", "correction_required"].includes(data.submission.status);
  const hasWarnings = data.rows.some((row) => row.status === "warning");
  const hasInvalidRows = data.rows.some((row) => row.status === "invalid");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); key.current ??= crypto.randomUUID(); setBusy(true); try { await confirm({ submissionId: id, acceptWarnings: f.has("acceptWarnings"), idempotencyKey: key.current }); setMessage("Confirmation started. This screen will update automatically."); } catch { setMessage("Confirmation was not completed. Fix invalid records, review any warnings and retry."); } finally { setBusy(false); } }
  async function resume() { setBusy(true); try { await retry({ submissionId: id }); setMessage("The same job was queued for retry."); } catch { setMessage("This job cannot be retried yet. Check its status and your permissions."); } finally { setBusy(false); } }
  async function discardUpload() { if (!window.confirm("Discard this unconfirmed upload and its temporary validation records?")) return; setBusy(true); try { await discard({ submissionId: id }); onClose(); } catch { setMessage("The upload could not be discarded while processing. Wait for validation to finish and retry."); } finally { setBusy(false); } }
  return <section className="data-card intake-review" aria-label="Submission review"><header className="team-dialog-header"><h2>Submission review</h2><button className="demo-button" onClick={onClose}>Close review</button></header><p><strong>{data.submission.fileName}</strong> · {labels(data.submission.status)}</p><p role="status">{data.job ? `${labels(data.job.stage)} · ${labels(data.job.status)}` : "Received"}</p>{data.job?.errorCode && <p role="alert">{jobError(data.job.errorCode)}</p>}
    {data.canWrite && data.submission.status !== "confirming" && data.job && ["failed", "blocked"].includes(data.job.status) && <button disabled={busy} className="demo-button" onClick={() => void resume()}>Retry processing</button>}
    {data.canWrite && data.submission.status === "correction_required" && data.job?.status === "completed" && <button disabled={busy} className="demo-button" onClick={() => { setBusy(true); void revalidate({ submissionId: id, idempotencyKey: crypto.randomUUID() }).then(() => setMessage("Revalidation started using the unchanged original file.")).catch(() => setMessage("Revalidation could not start. Check the stored status and your access.")).finally(() => setBusy(false)); }}>Revalidate original file</button>}
    {data.canWrite && data.submission.status === "confirming" && <button className="demo-button" disabled={busy} onClick={() => { const reason = window.prompt("Reason for cancelling interrupted confirmation"); if (reason && reason.trim().length >= 3) void cancel({ submissionId: id, reason, idempotencyKey: crypto.randomUUID() }).then(() => setMessage("Confirmation cancelled; review the records before confirming again.")).catch(() => setMessage("Confirmation is still running or cancellation is not permitted.")); }}>Recover interrupted confirmation</button>}
    {data.submission.status === "accepted" && <p role="status">Workflow linking: {labels(data.submission.projectionState ?? "queued")}{data.submission.projectionErrorCode && ` · ${labels(data.submission.projectionErrorCode)}`}</p>}
    {data.canWrite && data.submission.status === "accepted" && (!data.submission.projectionState || data.submission.projectionState === "blocked") && <button className="demo-button" disabled={busy} onClick={() => { setBusy(true); void linkWorkflow({ submissionId: id, idempotencyKey: crypto.randomUUID() }).then(() => setMessage("Workflow linking queued; follow the stored status.")).catch(() => setMessage("Workflow linking could not be queued. Check your access.")).finally(() => setBusy(false)); }}>Retry workflow linking</button>}
    {data.canDownload && <a className="demo-button" href={`/api/evidence/${id}`}>Download original evidence</a>}
    <div className="table-scroll"><table><thead><tr><th>Record</th><th>Product</th><th>Status</th><th>Checks</th><th>Action</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row._id}><td>{row.rowNumber}</td><td>{row.values?.product_name ?? "Not accepted"}</td><td>{row.status}</td><td>{row.errors.map(labels).join("; ") || "Passed structural checks"}</td><td>{ready && <button type="button" className="demo-button" onClick={() => setRecord(row.rowNumber)}>Correct / exclude</button>}</td></tr>)}</tbody></table></div>
    {record !== null && ready && <RowCorrection key={data.rows.find((r) => r.rowNumber === record)?._id} data={data} rowNumber={record} onClose={() => setRecord(null)}/>}
    {ready && hasInvalidRows && <p role="alert">Fix the issues before confirming.</p>}
    {ready && !hasInvalidRows && <form className="configuration-form" onSubmit={(e) => void submit(e)} onChange={() => { key.current = null; }}>{hasWarnings && <label className="team-unit-choice"><input type="checkbox" name="acceptWarnings"/>I reviewed and accept the listed warnings for reconciliation.</label>}<button type="submit" className="demo-button primary" disabled={busy}>Confirm records</button></form>}
    {!["accepted", "replaced", "confirming"].includes(data.submission.status) && <button type="button" className="demo-button" disabled={busy} onClick={() => void discardUpload()}>Discard upload</button>}
    <p role="status">{message}</p>
  </section>;
}
function RowCorrection({ data, rowNumber, onClose }: { data: FunctionReturnType<typeof api.intake.detail>; rowNumber: number; onClose: () => void }) {
  const template = data.correctionTemplate; const correct = useMutation(api.intake.correctRow); const [exclude, setExclude] = useState(false); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const key = useRef<string | null>(null);
  const row = data.rows.find((r) => r.rowNumber === rowNumber); if (!row) return <p>Record is no longer available.</p>;
  const requiredColumns = [...template.columns.required] as string[];
  const optionalColumns = [...template.columns.optional] as string[];
  const columns = ["template_version", ...requiredColumns, ...optionalColumns];
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!row || !template) return; const f = new FormData(event.currentTarget); const values = Object.fromEntries(columns.map((c) => [c, String(f.get(`value-${c}`) ?? "")])); key.current ??= crypto.randomUUID(); setBusy(true); try { await correct({ submissionId: data.submission._id, rowNumber, values, exclude, reason: String(f.get("reason")), idempotencyKey: key.current }); setMessage("A new record revision was saved. Review its validation result."); key.current = null; onClose(); } catch { setMessage("Correction could not be saved. Check the fields, reason and your access."); } finally { setBusy(false); } }
  return <form className="configuration-form" onSubmit={(e) => void submit(e)} onChange={() => { key.current = null; }}><h3>Correct record {rowNumber}</h3><label className="team-unit-choice"><input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)}/>Exclude this record</label>{!exclude && <fieldset className="intake-fields" disabled={busy}>{columns.map((c) => <label key={c}>{labels(c)}<input name={`value-${c}`} defaultValue={row.values?.[c] ?? (c === "template_version" ? String(template.version) : "")} required={c === "template_version" || requiredColumns.includes(c)} maxLength={160}/></label>)}</fieldset>}<label>Correction reason<input name="reason" required minLength={3} maxLength={1000}/></label><button type="submit" className="demo-button" disabled={busy}>Save record revision</button><button type="button" className="demo-button" onClick={onClose}>Cancel correction</button><p role="status">{message}</p></form>;
}
