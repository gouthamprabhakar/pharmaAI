"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import type { BusinessFilters } from "./returns-workspace";

type FilterContext = { organizationId: Id<"organizations">; filters: BusinessFilters; controls: ReactNode; invalidSelection: boolean };
const Context = createContext<FilterContext | null>(null);
export function WorkspaceFilters({ organizationId, children }: { organizationId: Id<"organizations">; children: ReactNode }) {
  const options = useQuery(api.workspace.filters, { organizationId }); const [unit, setUnit] = useState(""); const [distributor, setDistributor] = useState(""); const [period, setPeriod] = useState<string>();
  const selectedPeriod = period ?? options?.periods[0]?.value ?? "";
  const [periodStart, periodEnd] = selectedPeriod.split("|");
  const invalidSelection = !!options && (!!unit && !options.units.some((u) => u.id === unit) || !!distributor && !options.distributors.some((d) => d.id === distributor && (!unit || d.unitIds.includes(unit as Id<"operationalUnits">))));
  const controls = <><label>Depot<select value={unit} onChange={(e) => { setUnit(e.target.value); setDistributor(""); }}><option value="">All permitted depots</option>{options?.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Distributor<select value={distributor} onChange={(e) => setDistributor(e.target.value)}><option value="">All permitted distributors</option>{options?.distributors.filter((d) => !unit || d.unitIds.includes(unit as Id<"operationalUnits">)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Month<select value={selectedPeriod} onChange={(e) => setPeriod(e.target.value)}><option value="">All months</option>{options?.periods.map((p) => <option key={p.value} value={p.value}>{new Date(`${p.value.split("|")[0]}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}</select></label></>;
  const filters: BusinessFilters = { operationalUnitId: unit ? unit as Id<"operationalUnits"> : undefined, distributorId: distributor ? distributor as Id<"distributors"> : undefined, periodStart: periodStart || undefined, periodEnd: periodEnd || undefined };
  return <Context.Provider value={{ organizationId, filters, controls, invalidSelection }}>{children}</Context.Provider>;
}
export function useWorkspaceFilters() { const value = useContext(Context); if (!value) throw new Error("Workspace filter context required"); return value; }
