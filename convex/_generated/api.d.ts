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
import type * as development from "../development.js";
import type * as http from "../http.js";
import type * as invitationDelivery from "../invitationDelivery.js";
import type * as invitations from "../invitations.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_developmentPolicy from "../lib/developmentPolicy.js";
import type * as lib_permissions from "../lib/permissions.js";
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
  development: typeof development;
  http: typeof http;
  invitationDelivery: typeof invitationDelivery;
  invitations: typeof invitations;
  "lib/authorization": typeof lib_authorization;
  "lib/developmentPolicy": typeof lib_developmentPolicy;
  "lib/permissions": typeof lib_permissions;
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
