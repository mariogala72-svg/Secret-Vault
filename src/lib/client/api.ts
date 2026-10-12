"use client";
import { clientAuth } from "./firebase";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const u = clientAuth().currentUser;
  return u ? { Authorization: `Bearer ${await u.getIdToken()}` } : {};
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(await authHeader()),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? "Si è verificato un errore", body.code);
  }
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("application/json") ? res.json() : res.arrayBuffer()) as Promise<T>;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Si è verificato un errore");

export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Email o password non corretti",
    "auth/wrong-password": "Email o password non corretti",
    "auth/user-not-found": "Email o password non corretti",
    "auth/invalid-email": "Indirizzo email non valido",
    "auth/email-already-in-use": "Esiste già un account con questa email",
    "auth/weak-password": "La password è troppo debole",
    "auth/too-many-requests": "Troppi tentativi. Riprova tra qualche minuto",
    "auth/network-request-failed": "Problema di connessione. Riprova",
    "auth/requires-recent-login": "Per sicurezza accedi di nuovo",
  };
  return map[code] ?? errorMessage(e);
}
