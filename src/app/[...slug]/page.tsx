import type { Metadata } from "next";
import { WorkspaceDemo } from "@/components/workspace-demo";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspaceRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) redirect("/sign-in");
  await auth.protect();
  const { slug } = await params;
  return <WorkspaceDemo path={`/${slug.join("/")}`} />;
}
