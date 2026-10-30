"use node";
// Enforce response limits while streaming, not after allocating an unbounded body.
export async function boundedText(response: Response, maximum: number) {
  const declared = response.headers.get("content-length"); if (declared && Number(declared) > maximum) throw new Error("REMOTE_RESPONSE_TOO_LARGE");
  const reader = response.body?.getReader(); if (!reader) throw new Error("REMOTE_RESPONSE_MISSING"); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength; if (size > maximum) { await reader.cancel(); throw new Error("REMOTE_RESPONSE_TOO_LARGE"); } chunks.push(item.value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
