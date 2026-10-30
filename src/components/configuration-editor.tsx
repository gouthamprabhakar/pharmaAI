"use client";

import { useMutation, useQuery } from "convex/react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { rupeesToPaise } from "../../convex/lib/exact";

export const sectionLabels = { organization: "Organization", units: "Depots", distributors: "Distributors", products: "Products", aliases: "Product aliases", batches: "Batches", templates: "Templates", policies: "Return policies", tolerances: "Stock tolerances", deadlines: "Reporting deadlines" } as const;
export type ConfigSection = keyof typeof sectionLabels;
type Config = FunctionReturnType<typeof api.configuration.read>;
const evidenceLabels = { manufacturer_sales_shipments: "Manufacturer sales & shipments", distributor_return_claim: "Distributor return claim", distributor_sales_stock: "Distributor sales & stock", issued_credit_notes: "Issued credit notes" } as const;
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>;
const Input = ({ label, name, value, type = "text", required = true }: { label: string; name: string; value?: string; type?: string; required?: boolean }) => <Field label={label}><input name={name} type={type} defaultValue={value} required={required} maxLength={160}/></Field>;
const Select = ({ label, name, options, value, required = true }: { label: string; name: string; options: [string, string][]; value?: string; required?: boolean }) => <Field label={label}><select name={name} defaultValue={value ?? ""} required={required}><option value="">Choose {label.toLowerCase()}</option>{options.map(([id, title]) => <option value={id} key={id}>{title}</option>)}</select></Field>;
const unitsOf = (data: Config): [string, string][] => data.units.filter((u) => u.active).map((u) => [u._id, u.name]);

export function ConfigurationEditor({ section, organizationId }: { section: ConfigSection; organizationId: Id<"organizations"> }) {
  const data = useQuery(api.configuration.read, { organizationId });
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const saveOrg = useMutation(api.configuration.saveOrganization);
  const saveUnit = useMutation(api.configuration.saveUnit);
  const saveDistributor = useMutation(api.configuration.saveDistributor);
  const saveProduct = useMutation(api.configuration.saveProduct);
  const savePolicy = useMutation(api.configuration.savePolicy);
  const saveTolerance = useMutation(api.configuration.saveTolerance);
  const saveTemplate = useMutation(api.configuration.saveTemplate);
  const saveObligation = useMutation(api.configuration.saveObligation);
  const saveAlias = useMutation(api.configuration.saveAlias);
  const saveBatch = useMutation(api.configuration.saveBatch);
  if (!data) return <p role="status">Loading configuration…</p>;
  const globalOnly = ["organization", "products", "batches"].includes(section);
  const permitted = !globalOnly || data.allUnits;
  const currentUnit = data.units.find((u) => u._id === selected);
  const currentDistributor = data.distributors.find((d) => d._id === selected);
  const currentProduct = data.products.find((p) => p._id === selected);
  const editable = section === "units" ? data.units : section === "distributors" ? data.distributors : section === "products" ? data.products : [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!data) return;
    const form = event.currentTarget; const f = new FormData(form); const get = (name: string) => String(f.get(name) ?? "");
    const unitId = get("unit") as Id<"operationalUnits">; const productId = get("product") as Id<"products">; const distributorId = get("distributor") as Id<"distributors">;
    key.current ??= crypto.randomUUID();
    const base = { organizationId, reason: get("reason"), idempotencyKey: key.current };
    const version = { ...base, operationalUnitId: unitId, effectiveFrom: get("effectiveFrom") };
    setBusy(true); setMessage("");
    try {
      switch (section) {
        case "organization": await saveOrg({ ...base, name: get("name"), timezone: get("timezone") }); break;
        case "units": await saveUnit({ ...base, unitId: selected ? selected as Id<"operationalUnits"> : undefined, name: get("name"), code: get("code"), type: get("unitType") as "division" | "region" | "depot" | "cf", parentId: get("parent") ? get("parent") as Id<"operationalUnits"> : undefined, workflows: f.getAll("workflows") as ("returns" | "sales_stock" | "reporting")[], active: f.has("active") }); break;
        case "distributors": await saveDistributor({ ...base, distributorId: selected ? selected as Id<"distributors"> : undefined, name: get("name"), code: get("code"), operationalUnitIds: f.getAll("units") as Id<"operationalUnits">[], active: f.has("active") }); break;
        case "products": await saveProduct({ ...base, productId: selected ? selected as Id<"products"> : undefined, name: get("name"), code: get("code"), quantityUnit: get("quantityUnit"), active: f.has("active") }); break;
        case "aliases": await saveAlias({ ...base, productId, distributorId, alias: get("alias") }); break;
        case "batches": await saveBatch({ ...base, productId, batchNumber: get("batch"), expiryDate: get("expiry") }); break;
        case "templates": await saveTemplate({ ...version, evidenceType: get("evidenceType") as keyof typeof evidenceLabels, catalogVersion: "1" }); break;
        case "policies": await savePolicy({ ...version, code: get("code"), rules: { dateBasis: get("dateBasis") as "sale_date" | "return_date", allowedReasons: get("allowedReasons").split(",").map((v) => v.trim()), requiresReceipt: f.has("requiresReceipt"), daysBeforeExpiry: Number(get("before")), daysAfterExpiry: Number(get("after")), creditDueDays: Number(get("creditDue")), taxPercent: get("tax"), deductionPercent: get("deduction"), rounding: get("rounding") as "half_up" | "half_even" | "down" } }); break;
        case "tolerances": await saveTolerance({ ...version, quantityAbsolute: get("quantity"), valuePaise: rupeesToPaise(get("value")) }); break;
        case "deadlines": await saveObligation({ ...version, distributorId, templateId: get("template") as Id<"templates">, dueDayNextMonth: Number(get("day")), timezone: get("timezone"), active: f.has("active") }); break;
      }
      key.current = null; setMessage("Configuration saved. Its version and audit record were retained.");
    } catch { setMessage("Could not save. Check codes, dates, scope and required fields. Version dates must advance; codes and quantity units cannot be changed after creation."); }
    finally { setBusy(false); }
  }
  const versionSection = ["templates", "policies", "tolerances", "deadlines"].includes(section);
  return <section className="configuration-editor" aria-label={sectionLabels[section]}>
    <h3>{sectionLabels[section]}</h3>
    {editable.length > 0 && <label>Edit existing or add new<select value={selected} onChange={(e) => { setSelected(e.target.value); key.current = null; setMessage(""); }}><option value="">Add new</option>{editable.map((item) => <option key={item._id} value={item._id}>{item.code} · {item.name}{item.active ? "" : " (inactive)"}</option>)}</select></label>}
    {!permitted ? <p>Organization-wide configuration requires access to all operational units.</p> : <form key={`${section}-${selected}`} className="configuration-form" onSubmit={(e) => void submit(e)} onChange={() => { key.current = null; }}>
      <fieldset disabled={busy}>
        {section === "organization" && <><Input label="Manufacturer name" name="name" value={data.organization.name}/><Input label="Time zone" name="timezone" value={data.organization.timezone ?? undefined}/></>}
        {section === "units" && <><Input label="Unit name" name="name" value={currentUnit?.name}/><Input label="Unit code" name="code" value={currentUnit?.code}/><Select label="Unit type" name="unitType" value={currentUnit?.type} options={[["division", "Division"], ["region", "Region"], ["depot", "Depot"], ["cf", "C&F"]]}/><Select label="Parent unit" name="parent" value={currentUnit?.parentId} options={unitsOf(data).filter(([id]) => id !== selected)} required={false}/></>}
        {section === "units" && <fieldset className="configuration-choices"><legend>Which workflows apply?</legend>{([["returns", "Returns & Credits"], ["sales_stock", "Sales & Stock"], ["reporting", "Reporting only"]] as const).map(([value, label]) => <label className="team-unit-choice" key={value}><input type="checkbox" name="workflows" value={value} defaultChecked={currentUnit?.workflows?.includes(value) ?? value !== "reporting"}/>{label}</label>)}</fieldset>}
        {section === "distributors" && <><Input label="Distributor name" name="name" value={currentDistributor?.name}/><Input label="Distributor code" name="code" value={currentDistributor?.code}/><fieldset className="configuration-choices"><legend>Linked depots</legend>{unitsOf(data).map(([id, name]) => <label className="team-unit-choice" key={id}><input name="units" value={id} type="checkbox" defaultChecked={currentDistributor?.operationalUnitIds?.includes(id as Id<"operationalUnits">)}/>{name}</label>)}</fieldset></>}
        {section === "products" && <><Input label="Product name" name="name" value={currentProduct?.name}/><Input label="Product code" name="code" value={currentProduct?.code}/><Input label="Quantity unit" name="quantityUnit" value={currentProduct?.quantityUnit}/><p>Use one consistent unit, such as packs. The system does not infer pack-to-tablet conversions.</p></>}
        {["units", "distributors", "products", "deadlines"].includes(section) && <label className="team-unit-choice"><input type="checkbox" name="active" defaultChecked={section === "units" ? currentUnit?.active ?? true : section === "distributors" ? currentDistributor?.active ?? true : section === "products" ? currentProduct?.active ?? true : true}/>Active</label>}
        {["aliases", "batches"].includes(section) && <Select label="Product" name="product" options={data.products.filter((p) => p.active).map((p) => [p._id, `${p.code} · ${p.name}`])}/>}
        {["aliases", "deadlines"].includes(section) && <Select label="Distributor" name="distributor" options={data.distributors.filter((d) => d.active).map((d) => [d._id, d.name])}/>}
        {section === "aliases" && <Input label="Distributor product alias" name="alias"/>}
        {section === "batches" && <><Input label="Batch number" name="batch"/><Input label="Expiry date" name="expiry" type="date"/></>}
        {versionSection && <><Select label="Depot" name="unit" options={unitsOf(data)}/><Input label="Effective from" name="effectiveFrom" type="date"/><p>New versions preserve all earlier versions. Dates must advance for the same configuration.</p></>}
        {section === "templates" && <><Select label="Upload type" name="evidenceType" options={Object.entries(evidenceLabels)}/><p>Publishes controlled format 1. Required columns are fixed by the application; arbitrary field mapping is not introduced here.</p></>}
        {section === "policies" && <><Input label="Policy code" name="code"/><Select label="Policy version date basis" name="dateBasis" options={[["sale_date", "Original sale date"], ["return_date", "Return request date"]]}/><Input label="Allowed reasons, separated by commas" name="allowedReasons"/><Input label="Allowed days before expiry" name="before"/><Input label="Allowed days after expiry" name="after"/><Input label="Credit due within days of approval" name="creditDue"/><Input label="Deduction percent" name="deduction"/><Input label="Tax percent" name="tax"/><Select label="Line rounding" name="rounding" options={[["half_up", "Half up"], ["half_even", "Half even"], ["down", "Toward zero"]]}/><label className="team-unit-choice"><input type="checkbox" name="requiresReceipt" defaultChecked/>Require manufacturer receipt before approval</label><p>Enter only the manufacturer-approved policy. No eligibility or tax rule is assumed.</p></>}
        {section === "tolerances" && <><Input label="Absolute quantity tolerance" name="quantity"/><Input label="Absolute value tolerance (INR)" name="value"/><p>Both limits must be met to classify a variance within tolerance.</p></>}
        {section === "deadlines" && <><Select label="Monthly report template" name="template" options={data.templates.filter((t) => t.evidenceType === "distributor_sales_stock").map((t) => [t._id, `${data.units.find((u) => u._id === t.operationalUnitId)?.name} · version ${t.version} · ${t.effectiveFrom}`])}/><Input label="Due day of following month (1–28)" name="day"/><Input label="Deadline time zone" name="timezone" value={data.organization.timezone ?? undefined}/><p>This records the monthly obligation. Deadline checks create scoped in-app alerts; external reminder delivery is deferred.</p></>}
        <Input label="Reason for change" name="reason"/>
        <button className="demo-button primary" type="submit">{busy ? "Saving…" : "Save configuration"}</button>
      </fieldset>
    </form>}
    <p role="status" aria-live="polite">{message}</p>
    <ConfigurationList data={data} section={section}/>
  </section>;
}

function ConfigurationList({ data, section }: { data: Config; section: ConfigSection }) {
  const unitName = (id: string) => data.units.find((u) => u._id === id)?.name ?? "Unit";
  const rows: string[][] = section === "organization" ? [[data.organization.name, data.organization.timezone ?? "Time zone not set"]] : section === "units" ? data.units.map((u) => [u.code, u.name, u.active ? "Active" : "Inactive"]) : section === "distributors" ? data.distributors.map((d) => [d.code, d.name, d.active ? "Active" : "Inactive"]) : section === "products" ? data.products.map((p) => [p.code, p.name, p.quantityUnit ?? "Unit not set", p.active ? "Active" : "Inactive"]) : section === "aliases" ? data.aliases.map((a) => [a.alias, data.products.find((p) => p._id === a.productId)?.name ?? "Product"]) : section === "batches" ? data.batches.map((b) => [b.batchNumber, b.expiryDate]) : section === "templates" ? data.templates.map((t) => [evidenceLabels[t.evidenceType], unitName(t.operationalUnitId), `Version ${t.version}`, t.effectiveFrom]) : section === "policies" ? data.policies.map((p) => [p.code, unitName(p.operationalUnitId), `Version ${p.version}`, p.effectiveFrom]) : section === "tolerances" ? data.tolerances.map((t) => [unitName(t.operationalUnitId), t.quantityAbsolute, `${t.valuePaise} paise`, `Version ${t.version}`, t.effectiveFrom]) : data.obligations.map((o) => [data.distributors.find((d) => d._id === o.distributorId)?.name ?? "Distributor", unitName(o.operationalUnitId), `Day ${o.dueDayNextMonth} · ${o.timezone}`, `Version ${o.version}`, o.active ? "Active" : "Inactive"]);
  return <div className="configuration-records"><h4>Saved records</h4>{rows.length === 0 ? <p>No records configured yet.</p> : <ul>{rows.map((row, i) => <li key={i}>{row.join(" · ")}</li>)}</ul>}</div>;
}
