import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const ok = (data: unknown = { ok: true }, status = 200) => NextResponse.json(data, { status });

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Uniform error handling for route handlers; never leaks internals. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "Dati non validi", issues: e.issues.slice(0, 5) }, { status: 400 });
      console.error("[api]", req.method, new URL(req.url).pathname, e);
      return NextResponse.json({ error: "Si è verificato un errore. Riprova tra poco." }, { status: 500 });
    }
  };
}

export function appUrl(req?: Request) {
  const env = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
  if (env) return env.replace(/\/$/, "");
  return req ? new URL(req.url).origin : "http://localhost:3000";
}

export const iso = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v && "toDate" in v) return (v as { toDate(): Date }).toDate().toISOString();
  return null;
};
