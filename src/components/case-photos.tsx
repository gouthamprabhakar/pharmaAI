"use client";
import { AiAssistant } from "./ai-assistant";
import { useMutation, useQuery } from "convex/react";
import { useRef, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { statusLabel } from "@/lib/format-values";

export function CasePhotos({ caseId, canUpload, distributor = false }: { caseId: Id<"returnCases">; canUpload: boolean; distributor?: boolean }) {
  const session = useQuery(api.access.session, {});
  const rows = useQuery(api.documents.list, { caseId }); const start = useMutation(api.documents.requestUpload); const complete = useMutation(api.documents.completeUpload);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const key = useRef<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); const file = f.get("file") as File | null; if (!file?.size) return; key.current ??= crypto.randomUUID(); setBusy(true); try { const intent = await start({ caseId, fileName: file.name, contentType: file.type, sizeBytes: file.size, noPatientData: f.has("noPatientData"), idempotencyKey: key.current }); if (!intent.documentId && intent.uploadUrl) { const response = await fetch(intent.uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file }); if (!response.ok) throw new Error("UPLOAD_FAILED"); const value = await response.json() as { storageId: Id<"_storage"> }; await complete({ intentId: intent.intentId, storageId: value.storageId }); } key.current = null; setMessage("Evidence uploaded and available to authorized workspace members."); } catch { setMessage("Evidence upload was not confirmed. Check the file type, size and your access."); } finally { setBusy(false); } }
  return <section className="data-card intake-review"><h2>{distributor ? "Optional pre-dispatch evidence" : "Receipt photos and documents"}</h2><p>{distributor ? "These photos support your claim. The manufacturer separately confirms physical receipt." : "Photos support the manufacturer's receipt. Extraction suggestions require human confirmation."}</p>
    {canUpload && <form className="configuration-form" onSubmit={(e) => void submit(e)} onChange={() => { key.current = null; }}><label>Photo or PDF evidence<input type="file" name="file" accept="image/jpeg,image/png,application/pdf" required/></label><label className="team-unit-choice"><input type="checkbox" name="noPatientData" required/>This file contains no patient-identifiable information.</label><button className="demo-button" type="submit" disabled={busy}>Upload evidence</button></form>}
    <ul>{rows?.map((doc) => <li key={doc.id}><strong>{doc.fileName}</strong> · {doc.providedBy === "manufacturer" ? "Manufacturer / C&F" : "Distributor"} · {statusLabel(doc.status)}<a className="demo-button" href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer">Open evidence</a>{!distributor && session?.status === "authorized" && <AiAssistant organizationId={session.organizationId} targetType="return_case" targetId={caseId} documentId={doc.id} title="Extract document"/>}</li>)}</ul>{rows?.length === 0 && <p>No photos or documents attached.</p>}<p role="status">{message}</p>
  </section>;
}
