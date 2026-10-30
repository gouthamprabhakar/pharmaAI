"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { Brand } from "./brand";
import { ConfigurationEditor, sectionLabels, type ConfigSection } from "./configuration-editor";

const steps = ["organization", "units", "distributors", "templates"] as const;
export function GuidedSetup({ organizationId, role }: { organizationId: Id<"organizations">; role: string }) {
  const authorized = ["owner", "administrator"].includes(role);
  const data = useQuery(api.configuration.read, authorized ? { organizationId } : "skip");
  const saveProgress = useMutation(api.configuration.saveProgress);
  const [subsection, setSubsection] = useState<ConfigSection>("templates");
  const [message, setMessage] = useState("");
  if (!authorized) return <main className="setup-main"><h1>Setup access required</h1><p>Only your workspace owner or administrator can change configuration.</p><Link href="/overview">Return to Overview</Link></main>;
  if (!data) return <main className="setup-main"><p role="status">Loading saved setup…</p></main>;
  async function move(step: typeof steps[number]) { try { await saveProgress({ organizationId, step, reason: "Save guided setup position", idempotencyKey: crypto.randomUUID() }); setMessage(""); } catch { setMessage("Setup position could not be saved. Check your access and try again."); } }
  const index = steps.indexOf(data.progress);
  return <main className="setup-main" style={{maxWidth:1000,margin:"40px auto"}}><Brand/><div className="setup-title"><p>Guided setup · Step {index + 1} of 4</p><h1>Set up your manufacturer workspace</h1><p>Configure the evidence and rules needed for Returns &amp; Credits and Sales &amp; Stock.</p></div><div className="setup-grid"><section className="setup-card">
    {data.progress === "templates" && <label>Configure templates and rules<select value={subsection} onChange={(e) => setSubsection(e.target.value as ConfigSection)}>{(["templates", "products", "aliases", "batches", "policies", "tolerances", "deadlines"] as ConfigSection[]).map((s) => <option key={s} value={s}>{sectionLabels[s]}</option>)}</select></label>}
    <ConfigurationEditor key={data.progress === "templates" ? subsection : data.progress} organizationId={organizationId} section={data.progress === "templates" ? subsection : data.progress}/>
    <div className="configuration-actions">{index > 0 && <button className="demo-button" onClick={() => void move(steps[index - 1])}>Back</button>}{index < 3 && <button className="demo-button primary" onClick={() => void move(steps[index + 1])}>Continue setup</button>}</div><p role="status">{message}</p>
  </section><aside className="setup-preview"><h2>Four guided steps</h2>{steps.map((step, i) => <p key={step}><button className="demo-button" aria-current={step === data.progress ? "step" : undefined} onClick={() => void move(step)}>{i + 1}. {sectionLabels[step]}</button></p>)}<h3>Setup requirements</h3><p>{data.organization.timezone ? "✓ Organization time zone saved" : "Organization time zone needed"}</p><p>{data.units.some((u) => u.active) ? "✓ Operational units saved" : "Operational unit needed"}</p><p>{data.distributors.some((d) => d.active) ? "✓ Distributors saved" : "Distributor needed"}</p><p>{data.products.some((p) => p.active) ? "✓ Products saved" : "Product master needed"}</p><p>{data.templates.length ? "Templates saved; review required types" : "Templates needed"}</p><p>{data.policies.length ? "Return policy saved" : "Return policy needed"}</p><p>{data.obligations.length ? "Reporting deadline saved" : "Reporting deadlines needed"}</p><p>Policies, tolerances and deadlines require explicit manufacturer values. Sample data is optional and remains disabled unless explicitly enabled for development.</p><Link href="/administration" className="demo-button">Team &amp; access</Link><Link href="/overview" className="demo-button primary">Save and exit</Link></aside></div></main>;
}
