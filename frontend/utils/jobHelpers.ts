import type { Source, ArchivalType } from "../types";

function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
}

export function generateJobId(source: Source, archivalType: ArchivalType, timestamp: number = Date.now()): string {
  const timestampStr = formatTimestamp(timestamp);
  const randomStr = generateRandomString(32);
  return `${source}-${archivalType}-${timestampStr}-${randomStr}`;
}
