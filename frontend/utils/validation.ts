import { isValidYmd, parseEstDatetimeInput } from "./dateHelpers";
import type { ArchivalType } from "../types";

export function validateBeforeRun(
  archivalType: ArchivalType,
  date: string,
  start: string,
  end: string,
  normalizedUrls: string[],
  mostRecentSince: string,
  mostRecentCount: number,
  authToken: string
): string | null {
  if (!authToken || !authToken.trim()) return "Authentication token is required.";
  if (archivalType === "singleDay" && !isValidYmd(date)) return "Single-day selected, but date is invalid.";
  if (archivalType === "dateRange" && (!isValidYmd(start) || !isValidYmd(end)))
    return "Date-range selected, but start/end are invalid.";
  if (archivalType === "dateRange" && start > end) return "Date-range selected, but start date is after end date.";
  if (archivalType === "urls" && normalizedUrls.length === 0) return "URL list selected, but no URLs were provided.";
  if (archivalType === "mostRecent") {
    if (!mostRecentSince) return "Most-recent selected, but the starting date/time is invalid.";
    try {
      const since = parseEstDatetimeInput(mostRecentSince);
      if (Number.isNaN(since.getTime())) return "Most-recent selected, but the starting date/time is invalid.";
    } catch {
      return "Most-recent selected, but the starting date/time is invalid.";
    }
  }
  if (archivalType === "mostRecent" && (!Number.isFinite(mostRecentCount) || mostRecentCount <= 0))
    return "Most-recent selected, but item count must be a positive number.";
  return null;
}
