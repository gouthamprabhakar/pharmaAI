import { createClerkClient } from "@clerk/backend";
import { clerkSetup } from "@clerk/testing/playwright";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

export default async function setup() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!secretKey?.startsWith("sk_test_") || !publishableKey?.startsWith("pk_test_") || !process.env.CONVEX_DEPLOYMENT?.startsWith("dev:")) throw new Error("Authenticated browser checks require linked Clerk and Convex development credentials. Production is never used.");
  await clerkSetup({ secretKey, publishableKey });
  const clerk = createClerkClient({ secretKey });
  const runId = `e2e-${randomUUID()}`;
  const ownerEmail = `${runId}-owner+clerk_test@example.com`;
  const distributorEmail = `${runId}-distributor+clerk_test@example.com`;
  const outsiderEmail = `${runId}-outsider+clerk_test@example.com`;
  const inviteeEmail = `${runId}-invitee+clerk_test@example.com`;
  const users: string[] = [];
  let clerkOrganizationId: string | undefined;
  let fixture: { organizationId: string } | undefined;
  const run = (name: string, args: object) => JSON.parse(execFileSync("npx", ["convex", "run", name, JSON.stringify(args), "--deployment", "dev"], { encoding: "utf8", timeout: 60_000, stdio: ["ignore", "pipe", "pipe"] }));
  const cleanup = async () => {
    if (fixture) run("testing:deactivate", { organizationId: fixture.organizationId, runId });
    if (clerkOrganizationId) {
      const org = await clerk.organizations.getOrganization({ organizationId: clerkOrganizationId });
      if (org.privateMetadata.pharmaai_e2e_run !== runId) throw new Error("Refusing to remove a non-test Clerk workspace");
      await clerk.organizations.deleteOrganization(clerkOrganizationId);
    }
    for (const id of users) {
      const user = await clerk.users.getUser(id);
      if (user.externalId !== `${runId}:${id}`) throw new Error("Refusing to remove a non-test Clerk user");
      await clerk.users.deleteUser(id);
    }
  };
  try {
    const create = async (emailAddress: string, firstName: string) => {
      const user = await clerk.users.createUser({ emailAddress: [emailAddress], firstName, lastName: "Fictional Test", skipPasswordRequirement: true });
      await clerk.users.updateUser(user.id, { externalId: `${runId}:${user.id}` });
      users.push(user.id);
      return user;
    };
    const owner = await create(ownerEmail, "Owner");
    const distributor = await create(distributorEmail, "Distributor");
    await create(outsiderEmail, "Uninvited");
    const invitee = await create(inviteeEmail, "Invitee");
    const org = await clerk.organizations.createOrganization({ name: "Fictional Browser Test Manufacturer", createdBy: owner.id, maxAllowedMemberships: 5, privateMetadata: { pharmaai_e2e_run: runId } });
    clerkOrganizationId = org.id;
    await clerk.organizations.createOrganizationMembership({ organizationId: org.id, userId: distributor.id, role: "org:member" });
    await clerk.organizations.createOrganizationMembership({ organizationId: org.id, userId: invitee.id, role: "org:member" });
    fixture = run("testing:provision", { runId, clerkOrganizationId: org.id, ownerSubject: owner.id, distributorSubject: distributor.id, ownerEmail, distributorEmail });
    mkdirSync(".test-state", { recursive: true, mode: 0o700 });
    writeFileSync(".test-state/fixture.json", JSON.stringify({ ...fixture, runId, clerkOrganizationId: org.id, ownerEmail, distributorEmail, outsiderEmail, inviteeEmail }), { mode: 0o600 });
  } catch (error) {
    await cleanup();
    const safe = error as { status?: number; errors?: { code?: string }[] };
    throw new Error(`Development browser fixture setup failed (${safe.status ?? "configuration"}, ${safe.errors?.[0]?.code ?? "setup"}). No test was skipped.`);
  }
  return cleanup;
}
