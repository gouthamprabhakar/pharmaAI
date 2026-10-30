"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { WorkspaceAccess } from "@/components/workspace-access";
import { TeamAccess } from "@/components/team-access";
import { ConfigurationDialog } from "@/components/configuration-dialog";
import { GuidedSetup } from "@/components/guided-setup";
import type { ConfigSection } from "@/components/configuration-editor";
import { api } from "../../convex/_generated/api";

type Metric = { label: string; value: string; tone?: string };
type Screen = { title: string; subtitle: string; nav: string; action?: string; tabs?: string[]; metrics?: Metric[]; columns?: string[]; rows?: string[][]; panel?: { title: string; lines: string[]; ai?: string }; variant?: "table" | "form" | "settings" };

const navItems = [["Overview","/overview"],["Returns & Credits","/returns"],["Sales & Stock","/sales"],["Review Queue","/review-queue"],["Data Intake","/data"],["Reports","/reports"],["Administration","/administration"]] as const;
const liveAuthConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CONVEX_URL,
);

const screens: Record<string, Screen> = {
  "/overview": { title:"Overview", subtitle:"Returns, credits, distributor reporting and stock exceptions requiring attention.", nav:"Overview", action:"New data intake", metrics:[{label:"Returns awaiting eligibility review",value:"0"},{label:"Approved returns awaiting credit",value:"₹0"},{label:"Overdue credit obligations",value:"₹0"},{label:"Unexplained stock variance",value:"₹0"}], columns:["Recent evidence","Workflow","Owner","Status","Updated"], rows:[], panel:{title:"AI management brief",lines:["No evidence has been submitted","No brief is available yet","Human confirmation remains required"]}},
  "/data": { title:"Data Intake", subtitle:"Submit standard returns, sales, stock and credit evidence; correct only the rows that fail validation.", nav:"Data Intake", action:"Validate selected file", variant:"form", tabs:["New intake","Submission history","Templates"], panel:{title:"Validation checks",lines:["Template and required fields","Formats and known codes","Possible duplicates","Original file retained"]}},
  "/returns": { title:"Returns & Credits", subtitle:"Control every return from claim and eligibility through approval, issued credit and closure.", nav:"Returns & Credits", action:"New return intake", metrics:[{label:"Awaiting eligibility review",value:"0"},{label:"Approved awaiting credit",value:"₹0"},{label:"Partial or overdue credit",value:"₹0"},{label:"Issued credit this period",value:"₹0"}], columns:["Return case","Distributor","Claimed","Eligible","Issued credit","Status"], rows:[], panel:{title:"AI Returns & Credit Brief",lines:["No return evidence available","No cases are awaiting review","AI cannot approve or issue credit"]}},
  "/sales": { title:"Sales & Stock", subtitle:"Compare distributor opening stock, manufacturer shipments, onward sales, returns and reported closing stock.", nav:"Sales & Stock", action:"New stock report", metrics:[{label:"Reports accepted",value:"0"},{label:"Reports overdue",value:"0"},{label:"Open variances",value:"0"},{label:"Variance value exposure",value:"₹0"}], columns:["Product / batch","Distributor","Expected closing","Reported closing","Variance","Status"], rows:[], panel:{title:"AI variance brief",lines:["No stock reports available","No variances have been calculated","Human investigation remains required"]}},
  "/review-queue": { title:"Review Queue", subtitle:"One routed worklist for returns, credits, stock variances and data corrections.", nav:"Review Queue", metrics:[{label:"Critical / high",value:"0"},{label:"Overdue",value:"0"},{label:"Unassigned",value:"0"},{label:"Resolved this period",value:"0"}], columns:["Review item","Workflow","Priority","Status","Assigned team","Due"], rows:[], panel:{title:"Review details",lines:["No review item selected","Evidence will appear after data intake","Only authorized people can resolve items"]}},
  "/reports": { title:"Reports", subtitle:"Management reporting across returns, credits, distributor stock and review performance.", nav:"Reports", action:"Export report", tabs:["Executive summary","Returns & credits","Sales & stock","Review performance"], metrics:[{label:"Submitted return value",value:"₹0"},{label:"Issued credit",value:"₹0"},{label:"Open variance exposure",value:"₹0"},{label:"Reviews resolved on time",value:"—"}], columns:["Distributor","Return exposure","Stock variance","Open reviews","Risk"], rows:[], panel:{title:"AI management narrative",lines:["No reporting data available","No evidence-backed narrative can be generated","Upload data to begin"]}},
  "/administration": { title:"Administration", subtitle:"Manage workspace structure, users, distributors, templates, rules, security and audit evidence.", nav:"Administration", variant:"settings" },
};

function DemoButton({ children, className="", onClick }: { children:ReactNode; className?:string; onClick?:()=>void }) { return <button type="button" className={`demo-button ${className}`} onClick={onClick}>{children}</button>; }
function statusTone(value:string) { const status=value.toLowerCase(); if(status.includes("overdue")||status.includes("partial")||status.includes("investigate")) return "red"; if(status.includes("waiting")||status.includes("review")||status.includes("incomplete")||status.includes("correction")) return "amber"; if(status.includes("open")||status.includes("submitted")) return "blue"; return "green"; }

function LiveAccount() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const identity = useQuery(api.viewer.currentIdentity);
  const [signingOut, setSigningOut] = useState(false);
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Signed-in user";
  const initials = name.split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      window.location.replace("/");
    } catch {
      setSigningOut(false);
    }
  };
  return <div className="top-account"><div className="top-account-identity"><b>{initials || "PA"}</b><span className="top-account-copy">{name}<small>{identity ? "Authenticated with Clerk + Convex" : "Connecting securely…"}</small></span></div><button type="button" className="top-signout" disabled={signingOut} onClick={()=>void handleSignOut()}>{signingOut ? "Signing out…" : "Sign out"}</button></div>;
}

function AccountIdentity() {
  if (!liveAuthConfigured) return <div className="top-account"><b>PA</b><div>Workspace user<small>Administrator</small></div></div>;
  return <LiveAccount />;
}

function Invitation() { return <main className="auth-page"><section className="auth-form"><Brand/><p className="demo-eyebrow">Invitation found</p><h1>Join the PharmaAI workspace</h1><p className="auth-description">Your permitted organization, role and operational units will be applied after sign-in.</p><div className="demo-info"><div><strong>Role-based access</strong><p>Financial decisions remain with authorized people and are recorded.</p></div></div><Link href="/overview" className="demo-button primary">Continue to workspace</Link><Link className="auth-back" href="/sign-in">Use another account</Link></section></main>; }

function Panel({ panel, demo }: { panel:NonNullable<Screen["panel"]>; demo:(label:string)=>void }) { return <aside className="detail-panel"><div className="detail-panel-title"><h2>{panel.title}</h2><span className="demo-tag">Selected</span></div>{panel.ai&&<div className="demo-info"><div><strong>Evidence-linked AI assist</strong><p>{panel.ai}</p></div></div>}{panel.lines.map(line=><p key={line}><strong>{line}</strong></p>)}<hr/><p><strong>Human-controlled</strong><br/>No approval, credit, inventory change or resolution occurs automatically.</p><DemoButton className="primary" onClick={()=>demo(`Reviewing ${panel.title}`)}>Open evidence</DemoButton></aside>; }
function Settings({ demo }: { demo:(label:string)=>void }) {
  const [teamOpen,setTeamOpen]=useState(false); const [configuration,setConfiguration]=useState<string|null>(null);
  const sections: Record<string, ConfigSection[]> = { "Organization & operational units": ["organization", "units"], "Distributors": ["distributors", "deadlines"], "Reconciliation rules": ["policies", "tolerances"], "Templates & product codes": ["products", "aliases", "batches", "templates"] };
  const cards=["Organization & operational units","Distributors","Team & access","Reconciliation rules","Templates & product codes","AI assistance controls","Security & privacy","Audit history","Notifications & routing"];
  return <><div className="settings-grid">{cards.map(title=><article key={title}><h2>{title}</h2><p>Configure and review controlled workspace settings.</p><hr/><strong>{title==="Team & access"?"Workspace access controls":sections[title]?"Persistent configuration":"Not connected yet"}</strong><button aria-label={`Manage ${title}`} onClick={()=>title==="Team & access"?setTeamOpen(true):sections[title]?setConfiguration(title):demo(`Opening ${title}`)}>Manage →</button></article>)}</div><Link className="demo-button" href="/setup">Resume guided setup</Link>{teamOpen&&<TeamAccess onClose={()=>setTeamOpen(false)}/>} {configuration&&<ConfigurationDialog title={configuration} sections={sections[configuration]} onClose={()=>setConfiguration(null)}/>}</>;
}

function DataIntakeBody({ tab, panel, demo }: { tab:string; panel:Screen["panel"]; demo:(label:string)=>void }) {
  if(tab==="Templates") return <div className="workspace-content-grid"><section className="data-card"><div className="data-toolbar"><div><strong>Standard distributor templates</strong><p>Use the current controlled version for every submission.</p></div></div><div className="table-scroll"><table><thead><tr><th>Template</th><th>Version</th><th>Used for</th><th>Format</th><th>Action</th></tr></thead><tbody><tr><td>Manufacturer sales & shipment data</td><td>SALES-v1.0</td><td>Original sales and shipments</td><td>XLSX</td><td><a className="demo-button" href="/templates/micro-labs-manufacturer-sales.xlsx" download>Download</a></td></tr><tr><td>Distributor return claim</td><td>RET-v1.0</td><td>Return quantities and reasons</td><td>XLSX</td><td><span>Planned</span></td></tr><tr><td>Distributor sales & stock report</td><td>STOCK-v1.0</td><td>Opening, movements and closing stock</td><td>XLSX</td><td><a className="demo-button" href="/templates/distributor-sales-stock-report.xlsx" download>Download</a></td></tr><tr><td>Issued credit notes</td><td>CREDIT-v1.0</td><td>Credits issued against approved returns</td><td>XLSX</td><td><span>Planned</span></td></tr></tbody></table></div><div className="table-footer"><span>Two pilot templates are available now.</span></div></section><aside className="detail-panel"><div className="detail-panel-title"><h2>How templates work</h2><span className="demo-tag">Controlled</span></div><p><strong>One format per evidence type</strong></p><p>Required columns, accepted values and example rows are included in each template.</p><hr/><p><strong>Version checked on intake</strong><br/>Older or altered templates will be flagged before validation.</p></aside></div>;
  if(tab==="Submission history") return <div className="workspace-content-grid"><section className="data-card"><div className="data-toolbar"><label>Search<input placeholder="Search submissions…"/></label><label>Status<select><option>All statuses</option><option>Accepted</option><option>Correction required</option></select></label></div><div className="table-scroll"><table><thead><tr><th>Submission</th><th>Evidence type</th><th>Distributor</th><th>Period</th><th>Status</th></tr></thead><tbody /></table></div><div className="table-footer"><span>No submissions yet</span></div></section><aside className="detail-panel"><div className="detail-panel-title"><h2>Submission status</h2><span className="demo-tag">Empty</span></div><p><strong>Accepted</strong><br/>The file passed structural validation and its usable rows entered the relevant workflow.</p><hr/><p><strong>Correction required</strong><br/>The distributor must fix the identified rows and resubmit.</p></aside></div>;
  return <div className="workspace-content-grid"><section className="data-card form-card"><h2>Choose evidence type and standard template</h2><form><label>Evidence type<select><option>Manufacturer sales & shipment data</option><option>Distributor return claim</option><option>Sales & stock report</option><option>Issued credit notes</option></select></label><label>Operational unit<select><option value="">Select operational unit</option></select></label><label>Distributor<select><option value="">Select distributor</option></select></label><label>Report period<input placeholder="Select reporting period"/></label><div className="upload-zone wide"><strong>Choose an XLSX or CSV file</strong><span>File processing is not connected yet</span></div></form><div className="demo-info"><div><strong>Controlled template</strong><p>Open the Templates tab to download the required format. Invalid rows will be rejected with clear corrections.</p></div></div></section>{panel&&<Panel panel={panel} demo={demo}/>}</div>;
}

function Body({ screen, demo, activeTab }: { screen:Screen; demo:(label:string)=>void; activeTab?:string }) {
  const [query,setQuery]=useState(""); const rows=useMemo(()=>screen.rows?.filter(row=>row.join(" ").toLowerCase().includes(query.toLowerCase()))??[],[query,screen.rows]);
  if(screen.variant==="settings") return <Settings demo={demo}/>;
  if(screen.variant==="form") return <DataIntakeBody tab={activeTab??"New intake"} panel={screen.panel} demo={demo}/>;
  return <div className="workspace-content-grid"><section className="data-card"><div className="data-toolbar"><label>Search<input value={query} onChange={event=>setQuery(event.target.value)} placeholder={screen.nav==="Overview"?"Search recent activity…":"Search records…"}/></label><label>Status<select><option>All statuses</option></select></label></div>{screen.columns&&<div className="table-scroll"><table><thead><tr>{screen.columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={`${row[0]}-${i}`}>{row.map((cell,j)=><td key={j}>{(screen.nav==="Review Queue"?j===3:j===row.length-1)?<span className={`status ${statusTone(cell)}`}>{cell}</span>:cell}</td>)}</tr>)}</tbody></table></div>}<div className="table-footer"><span>No records yet</span></div></section>{screen.panel&&<Panel panel={screen.panel} demo={demo}/>}</div>;
}

function AppShell({ screen, organizationName }: { screen:Screen; organizationName:string }) {
  const [status,setStatus]=useState(""); const [tab,setTab]=useState(screen.tabs?.[0]??""); const demo=(label:string)=>setStatus(`${label} is simulated. No connected system was changed.`);
  return <div className="workspace-shell"><aside className="workspace-sidebar"><Brand/><nav>{navItems.map(([label,href])=><Link key={href} href={href} className={screen.nav===label?"active":""}><span className="nav-glyph" aria-hidden="true">{label.slice(0,1)}</span>{label}</Link>)}</nav><div className="fictional-card"><div><strong>Pilot workspace</strong><p>Business workflows are not connected yet.</p></div></div></aside><header className="workspace-topbar"><div className="fixed-workspace-context"><span>Manufacturer workspace</span><strong>{organizationName}</strong></div>{screen.nav!=="Data Intake"&&<><label>Operational unit<select><option>All permitted units</option></select></label><label>Distributor<select><option>All distributors</option></select></label><label>Reporting period<select><option>All reporting periods</option></select></label></>}<AccountIdentity /></header><main className="workspace-main"><div className="workspace-title"><div><p>{screen.nav}</p><h1>{screen.title}</h1><span>{screen.subtitle}</span></div><div className="title-actions"><span className="demo-tag">Sample workspace</span>{screen.action&&<DemoButton className="primary" onClick={()=>demo(screen.action!)}>{screen.action}</DemoButton>}</div></div>{screen.tabs&&<div className="workspace-tabs">{screen.tabs.map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}</button>)}</div>}{screen.metrics&&<div className="workspace-metrics">{screen.metrics.map(metric=><article key={metric.label} className={metric.tone??""}><span>{metric.label}</span><strong>{metric.value}</strong><button onClick={()=>demo(`Viewing ${metric.label}`)}>View evidence →</button></article>)}</div>}<Body screen={screen} demo={demo} activeTab={tab}/><p className="demo-live" role="status">{status}</p></main></div>;
}

function ConnectedWorkspace({ path }: { path:string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const session = useQuery(api.access.session, isAuthenticated ? {} : "skip");
  if (isLoading || (isAuthenticated && session === undefined)) return <main className="auth-page"><p role="status">Checking workspace access…</p></main>;
  if (session?.status !== "authorized") return <main className="auth-page"><section className="auth-form"><Brand/><h1>Workspace access required</h1><WorkspaceAccess status={session?.status}/><AccountIdentity /><Link className="auth-back" href="/sign-in">Return to sign in</Link></section></main>;
  if(path==="/workspace-invitation") return <Invitation/>;
  if(path==="/setup") return <GuidedSetup organizationId={session.organizationId} role={session.role}/>;
  const screen=screens[path];
  if(screen) return <>{session.developmentMfaOptional && <p className="demo-live" role="note">Development demo: MFA is optional. Real client use requires the deferred security checks.</p>}<AppShell screen={screen} organizationName={session.organizationName}/></>;
  return <main className="auth-page"><section className="auth-form"><Brand/><h1>Screen not found</h1><p className="auth-description">This route is not part of the approved 12-view MVP.</p><Link className="auth-back" href="/overview">Go to Overview →</Link></section></main>;
}

export function WorkspaceDemo({ path }: { path:string }) {
  if (!liveAuthConfigured) return <main className="auth-page"><section className="auth-form"><Brand/><h1>Workspace unavailable</h1><p className="auth-description">Authentication and backend configuration are required.</p><Link href="/sign-in">Return to sign in</Link></section></main>;
  return <ConnectedWorkspace path={path}/>;
}
