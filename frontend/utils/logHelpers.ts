/**
 * Log helpers.
 *
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 *
 * @file logHelpers.ts
 */

import type { LogLevel } from "../types";

/**
 * Formats a log timestamp.
 *
 * @param {number} ts - The timestamp.
 *
 * @returns {string} The formatted timestamp.
 */
export function formatLogTs(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Gets the class for a log level.
 *
 * @param {LogLevel} level - The log level.
 *
 * @returns {string} The class for the log level.
 */
export function levelClass(level: LogLevel) {
  if (level === "error") return "text-red-400";
  if (level === "warn") return "text-amber-300";
  if (level === "debug") return "text-sky-300";
  return "text-emerald-300";
}
