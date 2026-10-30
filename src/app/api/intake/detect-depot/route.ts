import { auth } from "@clerk/nextjs/server";
import { parseWorkbook } from "../../../../../convex/lib/parseWorkbook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session.userId) return Response.json({ error: "SIGN_IN_REQUIRED" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) {
    return Response.json({ error: "UNSUPPORTED_FILE" }, { status: 400 });
  }

  try {
    const rows = await parseWorkbook(Buffer.from(await file.arrayBuffer()), file.name);
    const [headers = [], ...records] = rows;
    const unitIndex = headers.indexOf("unit_name");
    const unitNames = [...new Set(records.map((row) => row[unitIndex]?.trim()).filter(Boolean))];
    if (unitIndex < 0 || unitNames.length !== 1) return Response.json({ error: "DEPOT_NOT_DETECTED" }, { status: 422 });
    return Response.json({ unitName: unitNames[0] });
  } catch {
    return Response.json({ error: "DEPOT_NOT_DETECTED" }, { status: 422 });
  }
}
