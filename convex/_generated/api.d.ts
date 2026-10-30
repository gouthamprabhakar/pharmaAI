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
import type * as configuration from "../configuration.js";
import type * as configurationSchema from "../configurationSchema.js";
import type * as development from "../development.js";
import type * as http from "../http.js";
import type * as intake from "../intake.js";
import type * as intakeJobs from "../intakeJobs.js";
import type * as intakeSchema from "../intakeSchema.js";
import type * as invitationDelivery from "../invitationDelivery.js";
import type * as invitations from "../invitations.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_contracts from "../lib/contracts.js";
import type * as lib_developmentPolicy from "../lib/developmentPolicy.js";
import type * as lib_exact from "../lib/exact.js";
import type * as lib_fileScanner from "../lib/fileScanner.js";
import type * as lib_intakeAccess from "../lib/intakeAccess.js";
import type * as lib_intakePermissions from "../lib/intakePermissions.js";
import type * as lib_normalizeRow from "../lib/normalizeRow.js";
import type * as lib_operations from "../lib/operations.js";
import type * as lib_parseWorkbook from "../lib/parseWorkbook.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_templateCatalog from "../lib/templateCatalog.js";
import type * as providerEvents from "../providerEvents.js";
import type * as testing from "../testing.js";
import type * as viewer from "../viewer.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  configuration: typeof configuration;
  configurationSchema: typeof configurationSchema;
  development: typeof development;
  http: typeof http;
  intake: typeof intake;
  intakeJobs: typeof intakeJobs;
  intakeSchema: typeof intakeSchema;
  invitationDelivery: typeof invitationDelivery;
  invitations: typeof invitations;
  "lib/authorization": typeof lib_authorization;
  "lib/contracts": typeof lib_contracts;
  "lib/developmentPolicy": typeof lib_developmentPolicy;
  "lib/exact": typeof lib_exact;
  "lib/fileScanner": typeof lib_fileScanner;
  "lib/intakeAccess": typeof lib_intakeAccess;
  "lib/intakePermissions": typeof lib_intakePermissions;
  "lib/normalizeRow": typeof lib_normalizeRow;
  "lib/operations": typeof lib_operations;
  "lib/parseWorkbook": typeof lib_parseWorkbook;
  "lib/permissions": typeof lib_permissions;
  "lib/templateCatalog": typeof lib_templateCatalog;
  providerEvents: typeof providerEvents;
  testing: typeof testing;
  viewer: typeof viewer;
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
