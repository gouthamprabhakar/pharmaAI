"use node";

import { createHash } from "node:crypto";

export async function scanFile(bytes: Buffer, fileName: string) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const endpoint = process.env.FILE_SCAN_URL; const key = process.env.FILE_SCAN_API_KEY;
  if (!endpoint || !key || !endpoint.startsWith("https://")) throw new Error("SCAN_NOT_CONFIGURED");
  // Explicit provider adapter. Required response covers malware and prohibited
  // patient data. Missing/malformed/unknown results never become a clean scan.
  const response = await fetch(endpoint, { method: "POST", redirect: "error", signal: AbortSignal.timeout(30_000), headers: { authorization: `Bearer ${key}`, "content-type": "application/octet-stream", "x-file-sha256": sha256, "x-file-name": encodeURIComponent(fileName) }, body: new Uint8Array(bytes) });
  if (!response.ok) throw new Error("SCAN_UNAVAILABLE");
  if (Number(response.headers.get("content-length")) > 8192) throw new Error("INVALID_SCAN_RESPONSE");
  const raw = await response.text(); if (raw.length > 8192) throw new Error("INVALID_SCAN_RESPONSE");
  const result = JSON.parse(raw) as Record<string, unknown>;
  if (result.sha256 !== sha256 || !["clean", "unsafe"].includes(String(result.verdict)) || typeof result.patientDataDetected !== "boolean" || typeof result.engine !== "string" || !result.engine || result.engine.length > 100 || typeof result.engineVersion !== "string" || !result.engineVersion || result.engineVersion.length > 100) throw new Error("INVALID_SCAN_RESPONSE");
  return { sha256, verdict: result.verdict as "clean" | "unsafe", patientDataDetected: result.patientDataDetected, engine: result.engine, engineVersion: result.engineVersion };
}
