/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as ai from "../ai.js";
import type * as aiJobs from "../aiJobs.js";
import type * as aiSchema from "../aiSchema.js";
import type * as auditHistory from "../auditHistory.js";
import type * as collaborationSchema from "../collaborationSchema.js";
import type * as compliance from "../compliance.js";
import type * as configuration from "../configuration.js";
import type * as configurationSchema from "../configurationSchema.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as deadlines from "../deadlines.js";
import type * as development from "../development.js";
import type * as discussions from "../discussions.js";
import type * as documentJobs from "../documentJobs.js";
import type * as documents from "../documents.js";
import type * as documentsSchema from "../documentsSchema.js";
import type * as http from "../http.js";
import type * as intake from "../intake.js";
import type * as intakeJobs from "../intakeJobs.js";
import type * as intakeSchema from "../intakeSchema.js";
import type * as invitationDelivery from "../invitationDelivery.js";
import type * as invitations from "../invitations.js";
import type * as lib_aiOutput from "../lib/aiOutput.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_boundedResponse from "../lib/boundedResponse.js";
import type * as lib_businessAudit from "../lib/businessAudit.js";
import type * as lib_businessSources from "../lib/businessSources.js";
import type * as lib_calendar from "../lib/calendar.js";
import type * as lib_caseAccess from "../lib/caseAccess.js";
import type * as lib_contracts from "../lib/contracts.js";
import type * as lib_creditMatching from "../lib/creditMatching.js";
import type * as lib_developmentPolicy from "../lib/developmentPolicy.js";
import type * as lib_discrepancy from "../lib/discrepancy.js";
import type * as lib_exact from "../lib/exact.js";
import type * as lib_fileScanner from "../lib/fileScanner.js";
import type * as lib_intakeAccess from "../lib/intakeAccess.js";
import type * as lib_intakePermissions from "../lib/intakePermissions.js";
import type * as lib_internalActor from "../lib/internalActor.js";
import type * as lib_normalizeRow from "../lib/normalizeRow.js";
import type * as lib_operations from "../lib/operations.js";
import type * as lib_parseWorkbook from "../lib/parseWorkbook.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_readScope from "../lib/readScope.js";
import type * as lib_returnCalculation from "../lib/returnCalculation.js";
import type * as lib_reviewRouting from "../lib/reviewRouting.js";
import type * as lib_stockCalculation from "../lib/stockCalculation.js";
import type * as lib_templateCatalog from "../lib/templateCatalog.js";
import type * as manufacturer from "../manufacturer.js";
import type * as monitoring from "../monitoring.js";
import type * as notifications from "../notifications.js";
import type * as projections from "../projections.js";
import type * as providerEvents from "../providerEvents.js";
import type * as refresh from "../refresh.js";
import type * as reports from "../reports.js";
import type * as returns from "../returns.js";
import type * as returnsSchema from "../returnsSchema.js";
import type * as review from "../review.js";
import type * as runs from "../runs.js";
import type * as stock from "../stock.js";
import type * as stockSchema from "../stockSchema.js";
import type * as testing from "../testing.js";
import type * as viewer from "../viewer.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  ai: typeof ai;
  aiJobs: typeof aiJobs;
  aiSchema: typeof aiSchema;
  auditHistory: typeof auditHistory;
  collaborationSchema: typeof collaborationSchema;
  compliance: typeof compliance;
  configuration: typeof configuration;
  configurationSchema: typeof configurationSchema;
  credits: typeof credits;
  crons: typeof crons;
  deadlines: typeof deadlines;
  development: typeof development;
  discussions: typeof discussions;
  documentJobs: typeof documentJobs;
  documents: typeof documents;
  documentsSchema: typeof documentsSchema;
  http: typeof http;
  intake: typeof intake;
  intakeJobs: typeof intakeJobs;
  intakeSchema: typeof intakeSchema;
  invitationDelivery: typeof invitationDelivery;
  invitations: typeof invitations;
  "lib/aiOutput": typeof lib_aiOutput;
  "lib/authorization": typeof lib_authorization;
  "lib/boundedResponse": typeof lib_boundedResponse;
  "lib/businessAudit": typeof lib_businessAudit;
  "lib/businessSources": typeof lib_businessSources;
  "lib/calendar": typeof lib_calendar;
  "lib/caseAccess": typeof lib_caseAccess;
  "lib/contracts": typeof lib_contracts;
  "lib/creditMatching": typeof lib_creditMatching;
  "lib/developmentPolicy": typeof lib_developmentPolicy;
  "lib/discrepancy": typeof lib_discrepancy;
  "lib/exact": typeof lib_exact;
  "lib/fileScanner": typeof lib_fileScanner;
  "lib/intakeAccess": typeof lib_intakeAccess;
  "lib/intakePermissions": typeof lib_intakePermissions;
  "lib/internalActor": typeof lib_internalActor;
  "lib/normalizeRow": typeof lib_normalizeRow;
  "lib/operations": typeof lib_operations;
  "lib/parseWorkbook": typeof lib_parseWorkbook;
  "lib/permissions": typeof lib_permissions;
  "lib/readScope": typeof lib_readScope;
  "lib/returnCalculation": typeof lib_returnCalculation;
  "lib/reviewRouting": typeof lib_reviewRouting;
  "lib/stockCalculation": typeof lib_stockCalculation;
  "lib/templateCatalog": typeof lib_templateCatalog;
  manufacturer: typeof manufacturer;
  monitoring: typeof monitoring;
  notifications: typeof notifications;
  projections: typeof projections;
  providerEvents: typeof providerEvents;
  refresh: typeof refresh;
  reports: typeof reports;
  returns: typeof returns;
  returnsSchema: typeof returnsSchema;
  review: typeof review;
  runs: typeof runs;
  stock: typeof stock;
  stockSchema: typeof stockSchema;
  testing: typeof testing;
  viewer: typeof viewer;
  workspace: typeof workspace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
