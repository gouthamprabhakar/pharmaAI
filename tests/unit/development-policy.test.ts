import { expect, test } from "vitest";
import { developmentMfaOptional } from "../../convex/lib/developmentPolicy";

const approved = { PHARMAAI_ENVIRONMENT: "development", PHARMAAI_DEVELOPMENT_MFA_OPTIONAL: "true", CLERK_JWT_ISSUER_DOMAIN: "https://fictional.clerk.accounts.dev" };

test("development MFA exception requires all three explicit conditions", () => {
  expect(developmentMfaOptional(approved)).toBe(true);
  expect(developmentMfaOptional({})).toBe(false);
});

test.each([
  { PHARMAAI_ENVIRONMENT: "production" },
  { PHARMAAI_ENVIRONMENT: "staging" },
  { PHARMAAI_ENVIRONMENT: undefined },
  { PHARMAAI_DEVELOPMENT_MFA_OPTIONAL: undefined },
  { PHARMAAI_DEVELOPMENT_MFA_OPTIONAL: "false" },
  { CLERK_JWT_ISSUER_DOMAIN: "https://clerk.manufacturer.example" },
  { CLERK_JWT_ISSUER_DOMAIN: "https://fictional.clerk.accounts.dev.attacker.example" },
  { CLERK_JWT_ISSUER_DOMAIN: "http://fictional.clerk.accounts.dev" },
  { CLERK_JWT_ISSUER_DOMAIN: undefined },
])("development MFA exception fails closed for %j", (changes) => {
  expect(developmentMfaOptional({ ...approved, ...changes })).toBe(false);
});
