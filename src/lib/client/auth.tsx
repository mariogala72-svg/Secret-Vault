"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { DeathSwitch } from "../types";

export type Me = {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  status?: "ACTIVE" | "DECEASED";
  hasVault?: boolean;
  counts?: Record<string, number>;
  received?: { total: number; unread: number };
  pendingInvitations?: number;
  deathSwitch?: DeathSwitch;
  openCase?: { id: string; status: string; contestUntil: string | null } | null;
  smsEnabled?: boolean;
};

type Ctx = {
  user: { uid: string; email: string } | null;
  me: Me | null;
  loading: boolean;
  configured: boolean;
  refresh: () => Promise<Me | null>;
  logout: (redirectTo?: string) => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const m = await api<Me>("/api/me");
      setMe(m);
      return m;
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 401) setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api<Me>("/api/me").then(setMe, () => setMe(null)).finally(() => setLoading(false));
  }, []);

  /** Full page navigation afterwards: wipes every in-memory key along with the page. */
  const logout = useCallback(async (redirectTo = "/") => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    try {
      localStorage.removeItem("sv:after-verify");
    } catch {}
    window.location.replace(redirectTo);
  }, []);

  const user = me ? { uid: me.id, email: me.email } : null;
  return <AuthContext.Provider value={{ user, me, loading, configured: true, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
