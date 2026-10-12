"use client";
import { fromB64, te, td, toB64 } from "../crypto/encoding";
import { aad } from "../crypto/message";
import { hkdf, open, seal } from "../crypto/primitives";
import type { UnlockedVault } from "../crypto/vault";
import { api } from "./api";

export type Contact = { id: string; name: string; relation?: string; email: string; phone?: string };

const contactsKey = (keys: UnlockedVault) => hkdf(keys.privateKey, "sv:v1:contacts-key");

export async function loadContacts(keys: UnlockedVault, uid: string): Promise<Contact[]> {
  const { contacts } = await api<{ contacts: { id: string; enc: string }[] }>("/api/contacts");
  const k = await contactsKey(keys);
  const out: Contact[] = [];
  for (const c of contacts) {
    try {
      out.push({ ...JSON.parse(td.decode(await open(k, fromB64(c.enc), aad.contact(uid, c.id)))), id: c.id });
    } catch {
      /* unreadable entry (e.g. from an old vault): skip */
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export async function saveContact(keys: UnlockedVault, uid: string, c: Contact, isNew: boolean) {
  const k = await contactsKey(keys);
  const enc = toB64(await seal(k, te.encode(JSON.stringify({ name: c.name, relation: c.relation, email: c.email, phone: c.phone })), aad.contact(uid, c.id)));
  if (isNew) await api("/api/contacts", { method: "POST", json: { id: c.id, enc } });
  else await api(`/api/contacts/${c.id}`, { method: "PUT", json: { enc } });
}

export const deleteContact = (id: string) => api(`/api/contacts/${id}`, { method: "DELETE" });
