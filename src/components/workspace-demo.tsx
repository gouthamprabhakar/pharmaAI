"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { WorkspaceAccess } from "@/components/workspace-access";
import { TeamAccess } from "@/components/team-access";
import { ConfigurationDialog } from "@/components/configuration-dialog";
import { GuidedSetup } from "@/components/guided-setup";
import { DataIntake } from "@/components/data-intake";
import { AdministrationSupport } from "./administration-support";
import { ReviewWorkspace } from "./review-workspace";
import { ReportingWorkspace } from "./reporting-workspace";
import { StockWorkspace, VarianceWorkspace } from "./stock-workspace";
import { ReturnsWorkspace } from "@/components/returns-workspace";
import { ReturnCaseWorkspace } from "@/components/return-case-workspace";
import { WorkspaceFilters, useWorkspaceFilters } from "@/components/workspace-filters";
import type { Role } from "../../convex/lib/permissions";
import type { Id } from "../../convex/_generated/dataModel";
import { allowedIntakeTypes } from "../../convex/lib/intakePermissions";
import type { ConfigSection } from "@/components/configuration-editor";
import { api } from "../../convex/_generated/api";

type Screen = { title: string; subtitle: string; nav: string; action?: string; tabs?: string[]; variant?: "form" | "settings" | "return_case" | "variance" };

const navItems = [["Overview","/overview"],["Returns & Credits","/returns"],["Sales & Stock","/sales"],["Review Queue","/review-queue"],["Data Intake","/data"],["Reports","/reports"],["Administration","/administration"]] as const;
const liveAuthConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CONVEX_URL,
);

const screens: Record<string, Screen> = {
  "/overview": { title: "Overview", subtitle: "Returns, credits, distributor reporting and stock exceptions requiring attention.", nav: "Overview", action: "New data intake" },
  "/data": { title: "Data Intake", subtitle: "Submit standard returns, sales, stock and credit evidence; correct the records needing attention.", nav: "Data Intake", action: "Upload and validate", variant: "form", tabs: ["New intake", "Submission history", "Templates"] },
  "/returns": { title: "Returns & Credits", subtitle: "Control every return from claim and eligibility through approval, issued credit and closure.", nav: "Returns & Credits", action: "New return intake" },
  "/sales": { title: "Sales & Stock", subtitle: "Compare distributor opening stock, manufacturer shipments, onward sales, returns and reported closing stock.", nav: "Sales & Stock", action: "New stock report" },
  "/review-queue": { title: "Review Queue", subtitle: "One routed worklist for returns, credits, stock variances and data corrections.", nav: "Review Queue" },
  "/reports": { title: "Reports", subtitle: "Management reporting across returns, credits, distributor stock and review performance.", nav: "Reports" },
  "/administration": { title: "Administration", subtitle: "Manage workspace structure, users, distributors, templates, rules, security and audit evidence.", nav: "Administration", variant: "settings" },
};

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
  return <div className="top-account"><div className="top-account-identity"><b>{initials || "PA"}</b><span className="top-account-copy">{name}<small>{identity ? "Workspace member" : "Connecting securely…"}</small></span></div><button type="button" className="top-signout" disabled={signingOut} onClick={()=>void handleSignOut()}>{signingOut ? "Signing out…" : "Sign out"}</button></div>;
}

function AccountIdentity() {
  if (!liveAuthConfigured) return <div className="top-account"><b>PA</b><div>Workspace user<small>Administrator</small></div></div>;
  return <LiveAccount />;
}

function Invitation() { return <main className="auth-page"><section className="auth-form"><Brand/><p className="demo-eyebrow">Invitation found</p><h1>Join the PharmaAI workspace</h1><p className="auth-description">Your permitted organization, role and operational units will be applied after sign-in.</p><div className="demo-info"><div><strong>Role-based access</strong><p>Financial decisions remain with authorized people and are recorded.</p></div></div><Link href="/overview" className="demo-button primary">Continue to workspace</Link><Link className="auth-back" href="/sign-in">Use another account</Link></section></main>; }

function Settings({ role }: { role: Role }) {
  const scope = useWorkspaceFilters();
  const [support, setSupport] = useState<string | null>(null);
  const [teamOpen,setTeamOpen]=useState(false); const [configuration,setConfiguration]=useState<string|null>(null);
  const sections: Record<string, ConfigSection[]> = { "Organization & operational units": ["organization", "units"], "Distributors": ["distributors", "deadlines"], "Reconciliation rules": ["policies", "tolerances"], "Templates & product codes": ["products", "aliases", "batches", "templates"] };
  const cards=["Organization & operational units","Distributors","Team & access","Reconciliation rules","Templates & product codes","AI assistance controls","Security & privacy","Audit history","Notifications & routing"];
  return <><div className="settings-grid">{cards.map(title=><article key={title}><h2>{title}</h2><p>Configure and review controlled workspace settings.</p><hr/><strong>{title==="Team & access"?"Workspace access controls":sections[title]?"Persistent configuration":"Workspace controls"}</strong><button disabled={!["owner", "administrator"].includes(role) && (title === "Team & access" || !!sections[title])} aria-label={`Manage ${title}`} onClick={()=>title==="Team & access"?setTeamOpen(true):sections[title]?setConfiguration(title):setSupport(title)}>Manage →</button></article>)}</div>{["owner", "administrator"].includes(role)&&<Link className="demo-button" href="/setup">Resume guided setup</Link>}{support&&<AdministrationSupport section={support} organizationId={scope.organizationId} role={role} onClose={()=>setSupport(null)}/>}{teamOpen&&<TeamAccess onClose={()=>setTeamOpen(false)}/>} {configuration&&<ConfigurationDialog title={configuration} sections={sections[configuration]} onClose={()=>setConfiguration(null)}/>}</>;
}


function Body({ screen, activeTab, role, recordId }: { screen:Screen; activeTab?:string; role: Role; recordId?: string }) {
  const scope = useWorkspaceFilters();
  if(screen.variant==="variance" && recordId) return <VarianceWorkspace key={recordId} varianceId={recordId as Id<"stockVariances">}/>;
  if(screen.variant==="return_case" && recordId) return <ReturnCaseWorkspace key={recordId} caseId={recordId as Id<"returnCases">}/>;
  if(screen.variant==="settings") return <Settings role={role}/>;
  if(screen.variant==="form") return <DataIntake tab={activeTab??"New intake"}/>;
  if(scope.invalidSelection) return <p role="alert">Your permitted scope changed. Choose an available operational unit and distributor.</p>;
  if(screen.nav==="Review Queue") return <ReviewWorkspace organizationId={scope.organizationId} filters={scope.filters} role={role}/>;
  if(screen.nav==="Overview" || screen.nav==="Reports") return <ReportingWorkspace organizationId={scope.organizationId} filters={scope.filters} role={role} overview={screen.nav==="Overview"}/>;
  if(screen.nav==="Sales & Stock") return <StockWorkspace organizationId={scope.organizationId} filters={scope.filters} role={role}/>;
  if(screen.nav==="Returns & Credits") return <ReturnsWorkspace organizationId={scope.organizationId} filters={scope.filters} role={role}/>;
  return <p>This area is unavailable. Choose an available workspace from the navigation.</p>;
}

function AppShell({ screen, organizationName, role, recordId }: { screen:Screen; organizationName:string; role:Role; recordId?: string }) {
  const scope = useWorkspaceFilters();
  const [tab,setTab]=useState(screen.tabs?.[0]??"");
  return <div className="workspace-shell"><aside className="workspace-sidebar"><Brand/><nav>{navItems.map(([label,href])=><Link key={href} href={href} className={screen.nav===label?"active":""}><span className="nav-glyph" aria-hidden="true">{label.slice(0,1)}</span>{label}</Link>)}</nav><div className="fictional-card"><div><strong>Pilot workspace</strong><p>Development pilot. Use fictional data until the remaining security checks are complete.</p></div></div></aside><header className="workspace-topbar"><div className="fixed-workspace-context"><span>Manufacturer workspace</span><strong>{organizationName}</strong></div>{!["Data Intake", "Administration"].includes(screen.nav)&&!["return_case", "variance"].includes(screen.variant??"")&&scope.controls}<AccountIdentity /></header><main className="workspace-main"><div className="workspace-title"><div><p>{screen.nav}</p><h1>{screen.title}</h1><span>{screen.subtitle}</span></div><div className="title-actions"><span className="demo-tag">Development workspace</span>{screen.action&&(screen.nav==="Data Intake"?(tab==="New intake"&&allowedIntakeTypes(role).length>0&&<button type="submit" form="intake-form" className="demo-button primary">Upload and validate</button>):screen.nav==="Returns & Credits"?<Link className="demo-button primary" href="/data?type=distributor_return_claim">New return intake</Link>:screen.nav==="Overview"?<Link className="demo-button primary" href="/data">New data intake</Link>:screen.nav==="Sales & Stock"?<Link className="demo-button primary" href="/data?type=distributor_sales_stock">New stock report</Link>:null)}</div></div>{screen.tabs&&screen.nav!=="Reports"&&<div className="workspace-tabs">{screen.tabs.map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}</button>)}</div>}<Body screen={screen} activeTab={tab} role={role} recordId={recordId}/></main></div>;
}

function ConnectedWorkspace({ path }: { path:string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const session = useQuery(api.access.session, isAuthenticated ? {} : "skip");
  if (isLoading || (isAuthenticated && session === undefined)) return <main className="auth-page"><p role="status">Checking workspace access…</p></main>;
  if (session?.status !== "authorized") return <main className="auth-page"><section className="auth-form"><Brand/><h1>Workspace access required</h1><WorkspaceAccess status={session?.status}/><AccountIdentity /><Link className="auth-back" href="/sign-in">Return to sign in</Link></section></main>;
  if(path==="/workspace-invitation") return <Invitation/>;
  if(path==="/setup") return <GuidedSetup organizationId={session.organizationId} role={session.role}/>;
  const recordId = path.startsWith("/returns/") ? path.slice("/returns/".length) : path.startsWith("/sales/") ? path.slice("/sales/".length) : undefined;
  const screen: Screen | undefined = recordId && path.startsWith("/sales/") ? { title: "Variance workspace", subtitle: "Review stock movements, source evidence and human decisions.", nav: "Sales & Stock", variant: "variance" } : recordId ? { title: "Return case workspace", subtitle: "Review the sale, return, receipt, policy, decision and issued credit evidence.", nav: "Returns & Credits", variant: "return_case" } : screens[path];
  if(screen) return <>{session.developmentMfaOptional && <p className="demo-live" role="note">Development demo: MFA is optional. Real client use requires the deferred security checks.</p>}<WorkspaceFilters key={session.organizationId} organizationId={session.organizationId}><AppShell key={path} screen={screen} organizationName={session.organizationName} role={session.role} recordId={recordId}/></WorkspaceFilters></>;
  return <main className="auth-page"><section className="auth-form"><Brand/><h1>Screen not found</h1><p className="auth-description">This route is not part of the approved 12-view MVP.</p><Link className="auth-back" href="/overview">Go to Overview →</Link></section></main>;
}

export function WorkspaceDemo({ path }: { path:string }) {
  if (!liveAuthConfigured) return <main className="auth-page"><section className="auth-form"><Brand/><h1>Workspace unavailable</h1><p className="auth-description">Authentication and backend configuration are required.</p><Link href="/sign-in">Return to sign in</Link></section></main>;
  return <ConnectedWorkspace path={path}/>;
}
