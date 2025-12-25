import type { LogLevel } from "../types";

export function formatLogTs(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function levelClass(level: LogLevel) {
  if (level === "error") return "text-red-400";
  if (level === "warn") return "text-amber-300";
  if (level === "debug") return "text-sky-300";
  return "text-emerald-300";
}
