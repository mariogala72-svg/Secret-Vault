"use client";
import type { JSONContent } from "@tiptap/react";
import { aad, decryptText, unwrapOwnerDek } from "../crypto/message";
import type { UnlockedVault } from "../crypto/vault";
import type { AttachmentMeta, MessageView } from "../types";

export async function openOwnedMessage(keys: UnlockedVault, m: MessageView) {
  const dek = await unwrapOwnerDek(keys.privateKey, m.ownerWrappedDek, m.id);
  const title = await decryptText(dek, m.encTitle, aad.title(m.id));
  const body = m.encBody ? (JSON.parse(await decryptText(dek, m.encBody, aad.body(m.id))) as JSONContent) : null;
  const attachments = await decryptAttachmentMetas(dek, m.attachments);
  return { dek, title, body, attachments };
}

export async function decryptAttachmentMetas(dek: Uint8Array<ArrayBuffer>, list: AttachmentMeta[]) {
  return Promise.all(
    list.map(async (a) => {
      const meta = JSON.parse(await decryptText(dek, a.encMeta, aad.attMeta(a.id))) as { name: string; mime: string; size: number };
      return { ...a, name: meta.name, mime: meta.mime, size: meta.size, plainSize: meta.size };
    }),
  );
}
