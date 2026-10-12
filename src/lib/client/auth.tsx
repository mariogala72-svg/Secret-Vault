"use client";
import { onIdTokenChanged, signOut, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { clientAuth, firebaseConfigured } from "./firebase";
import type { DeathSwitch } from "../types";

export type Me = {
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
  user: User | null;
  me: Me | null;
  loading: boolean;
  configured: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = firebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(configured);

  const refresh = useCallback(async () => {
    if (!clientAuth().currentUser) return setMe(null);
    try {
      setMe(await api<Me>("/api/me"));
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    return onIdTokenChanged(clientAuth(), async (u) => {
      setUser(u);
      if (u) await refresh();
      else setMe(null);
      setLoading(false);
    });
  }, [configured, refresh]);

  const logout = useCallback(async () => {
    sessionStorage.clear();
    await signOut(clientAuth());
  }, []);

  return <AuthContext.Provider value={{ user, me, loading, configured, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
