import { isValidYmd } from "./dateHelpers";

type ArchivalType = "singleDay" | "dateRange" | "urls" | "mostRecent";
type Delivery = "download" | "email";
type Schedule = "now" | "later";

export function validateBeforeRun(
  delivery: Delivery,
  archivalType: ArchivalType,
  date: string,
  start: string,
  end: string,
  normalizedUrls: string[],
  mostRecentSince: string,
  mostRecentCount: number,
  schedule: Schedule,
  scheduledFor: string,
  email: string
): string | null {
  if (delivery === "email" && !email.trim()) return "Email delivery selected, but email address is empty.";
  if (archivalType === "singleDay" && !isValidYmd(date)) return "Single-day selected, but date is invalid.";
  if (archivalType === "dateRange" && (!isValidYmd(start) || !isValidYmd(end)))
    return "Date-range selected, but start/end are invalid.";
  if (archivalType === "dateRange" && start > end) return "Date-range selected, but start date is after end date.";
  if (archivalType === "urls" && normalizedUrls.length === 0) return "URL list selected, but no URLs were provided.";
  if (archivalType === "mostRecent" && (!mostRecentSince || Number.isNaN(new Date(mostRecentSince).getTime())))
    return "Most-recent selected, but the starting date/time is invalid.";
  if (archivalType === "mostRecent" && (!Number.isFinite(mostRecentCount) || mostRecentCount <= 0))
    return "Most-recent selected, but item count must be a positive number.";
  if (schedule === "later" && (!scheduledFor || Number.isNaN(new Date(scheduledFor).getTime())))
    return "Schedule set to later, but scheduled time is invalid.";
  return null;
}

