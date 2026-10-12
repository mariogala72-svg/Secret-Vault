"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
      aria-label={mounted ? (dark ? "Passa al tema chiaro" : "Passa al tema scuro") : "Cambia tema"}
    >
      {mounted ? dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" /> : <span className="size-[18px]" />}
    </button>
  );
}
