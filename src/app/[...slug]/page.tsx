import type { Metadata } from "next";
import { WorkspaceDemo } from "@/components/workspace-demo";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspaceRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  return <WorkspaceDemo path={`/${slug.join("/")}`} />;
}
