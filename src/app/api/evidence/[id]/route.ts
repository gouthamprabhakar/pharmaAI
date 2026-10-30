import { auth } from "@clerk/nextjs/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return new Response("Evidence service unavailable", { status: 503 });
  const session = await auth(); if (!session.userId) return new Response("Sign in required", { status: 401 });
  const token = await session.getToken(); const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!token || !site) return new Response("Evidence service unavailable", { status: 503 });
  const { id } = await context.params;
  try {
    const response = await fetch(`${site}/evidence?submissionId=${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error" });
    if (!response.ok) return new Response("Evidence is unavailable or access is denied", { status: response.status === 403 ? 403 : 404 });
    return new Response(response.body, { headers: { "content-type": "application/octet-stream", "content-disposition": response.headers.get("content-disposition") ?? "attachment", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "sandbox" } });
  } catch { return new Response("Evidence service unavailable", { status: 503 }); }
}
