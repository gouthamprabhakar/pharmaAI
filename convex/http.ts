import { verifyWebhook } from "@clerk/backend/webhooks";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();
http.route({ path: "/clerk/webhook", method: "POST", handler: httpAction(async (ctx, request) => {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  const instance = process.env.CLERK_INSTANCE_ID;
  if (!secret || !instance) return new Response("Webhook not configured", { status: 503 });
  if (Number(request.headers.get("content-length")) > 262_144) return new Response("Payload too large", { status: 413 });
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 262_144) return new Response("Payload too large", { status: 413 });
  let event;
  try {
    event = await verifyWebhook(new Request(request.url, { method: "POST", headers: request.headers, body }), { signingSecret: secret });
  } catch { return new Response("Invalid webhook", { status: 400 }); }
  if (!event || typeof event.type !== "string" || !event.data || typeof event.data !== "object") return new Response("Invalid webhook", { status: 400 });
  const eventId = request.headers.get("svix-id")?.trim();
  if (!eventId || eventId.length > 200 || event.instance_id !== instance || !Number.isSafeInteger(event.timestamp) || event.timestamp < 1 || event.timestamp > Date.now() + 300_000) return new Response("Invalid webhook", { status: 400 });
  // Never store raw provider payloads, addresses, tokens, or request metadata.
  const data = event.data as unknown as Record<string, unknown>;
  let subject = typeof data.id === "string" ? data.id : "";
  let organization: string | undefined;
  let role: string | undefined;
  if (event.type.startsWith("organizationMembership.")) {
    const org = data.organization as { id?: unknown } | undefined;
    const user = data.public_user_data as { user_id?: unknown } | undefined;
    organization = typeof org?.id === "string" ? org.id : undefined;
    subject = typeof user?.user_id === "string" ? user.user_id : "";
    role = typeof data.role === "string" ? data.role : undefined;
    if (!organization) return new Response("Invalid webhook", { status: 400 });
  }
  if (event.type === "organizationMembership.updated" && !role) return new Response("Invalid webhook", { status: 400 });
  if (!subject || subject.length > 200 || (organization?.length ?? 0) > 200) return new Response("Invalid webhook", { status: 400 });
  await ctx.runMutation(internal.providerEvents.apply, { eventId, eventType: event.type, subject, organization, role, occurredAt: event.timestamp, blocked: data.banned === true || data.locked === true });
  return new Response("OK", { status: 200 });
}) });
export default http;
