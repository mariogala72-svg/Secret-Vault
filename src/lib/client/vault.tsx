"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { wipe } from "../crypto/encoding";
import type { UnlockedVault } from "../crypto/vault";
import { useAuth } from "./auth";

const IDLE_MS = 10 * 60_000;

type Ctx = {
  keys: UnlockedVault | null;
  unlockedAt: number | null;
  setKeys: (k: UnlockedVault) => void;
  lock: () => void;
  remainingMs: number;
};

const VaultContext = createContext<Ctx | null>(null);

/** Vault keys live only in memory: never in storage, gone on lock, idle timeout, logout or tab close. */
export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setKeysState] = useState<{ uid: string; keys: UnlockedVault } | null>(null);
  // Keys are only exposed to the user who unlocked them: signing out hides them immediately.
  const keys = state && user && state.uid === user.uid ? state.keys : null;
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null);
  const lastActivity = useRef(0);
  const [remainingMs, setRemaining] = useState(IDLE_MS);

  const lock = useCallback(() => {
    setKeysState((s) => {
      if (s) wipe(s.keys.privateKey);
      return null;
    });
    setUnlockedAt(null);
  }, []);

  const setKeys = useCallback(
    (k: UnlockedVault) => {
      if (!user) return;
      lastActivity.current = Date.now();
      setKeysState({ uid: user.uid, keys: k });
      setUnlockedAt(Date.now());
    },
    [user],
  );

  useEffect(() => {
    if (!keys) return;
    const bump = () => (lastActivity.current = Date.now());
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      const left = IDLE_MS - (Date.now() - lastActivity.current);
      setRemaining(left);
      if (left <= 0) lock();
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
  }, [keys, lock]);

  return <VaultContext.Provider value={{ keys, unlockedAt, setKeys, lock, remainingMs }}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const c = useContext(VaultContext);
  if (!c) throw new Error("useVault outside VaultProvider");
  return c;
}
