"use client";
import { Download, FileText, ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "../ui/spinner";
import { decryptAttachment, saveBlob } from "@/lib/client/attachments";
import { errorMessage } from "@/lib/client/api";
import { fmtSize } from "@/lib/client/format";

export type PlainAttachment = { id: string; chunkCount: number; name: string; mime: string; size: number };

function ImagePreview({ dek, a }: { dek: Uint8Array<ArrayBuffer>; a: PlainAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    decryptAttachment(dek, a, a.mime).then((b) => setUrl((u = URL.createObjectURL(b))), () => {});
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [dek, a]);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={a.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />
  ) : (
    <div className="skeleton aspect-[4/3] w-full rounded-2xl" />
  );
}

export function AttachmentList({ dek, items }: { dek: Uint8Array<ArrayBuffer>; items: PlainAttachment[] }) {
  const [busy, setBusy] = useState<Record<string, number>>({});
  if (!items.length) return null;
  const images = items.filter((a) => a.mime.startsWith("image/") && a.size < 8 * 1048576);

  async function download(a: PlainAttachment) {
    try {
      setBusy((b) => ({ ...b, [a.id]: 0 }));
      const blob = await decryptAttachment(dek, a, a.mime, (p) => setBusy((b) => ({ ...b, [a.id]: p })));
      saveBlob(blob, a.name);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[a.id];
        return n;
      });
    }
  }

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((a) => <ImagePreview key={a.id} dek={dek} a={a} />)}
        </div>
      )}
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-solid/50 p-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">{a.mime.startsWith("image/") ? <ImageIcon className="size-5 text-accent" /> : <FileText className="size-5 text-gold" />}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted">{fmtSize(a.size)}</p>
            </div>
            <button onClick={() => download(a)} disabled={a.id in busy} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-60">
              {a.id in busy ? <><Spinner className="size-4" /> {Math.round(busy[a.id] * 100)}%</> : <><Download className="size-4" /> Scarica</>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
