"use client";
import { api } from "./api";
import { decryptChunk } from "../crypto/message";

/** Downloads, decrypts and reassembles an attachment entirely in the browser. */
export async function decryptAttachment(dek: Uint8Array<ArrayBuffer>, a: { id: string; chunkCount: number }, mime: string, onProgress?: (p: number) => void): Promise<Blob> {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  for (let n = 0; n < a.chunkCount; n++) {
    const buf = await api<ArrayBuffer>(`/api/attachments/${a.id}/${n}`);
    parts.push(await decryptChunk(dek, a.id, n, new Uint8Array(buf)));
    onProgress?.((n + 1) / a.chunkCount);
  }
  return new Blob(parts, { type: mime || "application/octet-stream" });
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name, rel: "noopener" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
