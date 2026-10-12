import type { Trigger } from "../types";

export const fmtDate = (iso: string | null | undefined, withTime = false) =>
  iso ? new Intl.DateTimeFormat("it-IT", withTime ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" }).format(new Date(iso)) : "—";

export const fmtRelative = (iso: string | null | undefined) => {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3600e3) return rtf.format(Math.round(diff / 60e3), "minute");
  if (abs < 86400e3) return rtf.format(Math.round(diff / 3600e3), "hour");
  if (abs < 60 * 86400e3) return rtf.format(Math.round(diff / 86400e3), "day");
  if (abs < 730 * 86400e3) return rtf.format(Math.round(diff / (30 * 86400e3)), "month");
  return rtf.format(Math.round(diff / (365 * 86400e3)), "year");
};

export const OCCASIONS: Record<string, string> = {
  BIRTHDAY: "Compleanno",
  ANNIVERSARY: "Anniversario",
  WEDDING: "Matrimonio",
  COMING_OF_AGE: "Maggiore età",
  OTHER: "Altro",
};

export function triggerLabel(t: Trigger): string {
  switch (t.kind) {
    case "FIXED_DATE":
      return `${t.occasion && t.occasion !== "OTHER" ? OCCASIONS[t.occasion] + " · " : ""}${fmtDate(t.fireAt, true)}`;
    case "MANUAL_NOW":
      return "Invio immediato";
    case "MANUAL_LATER":
      return "Lo invierai tu quando vorrai";
    case "DEATH":
      return "Quando non ci sarai più";
    case "DATE_OR_DEATH":
      return `Il ${fmtDate(t.fireAt, true)}, o prima se non ci sarai più`;
  }
}

export const newId = () => crypto.randomUUID();

export const fmtSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);
