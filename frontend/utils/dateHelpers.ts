import { ArchivalConfig, DateRangeParams, MostRecentParams, SingleDayParams, UrlsParams } from "@/types";

export function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function dateToEstDatetimeInput(d: Date): string {
  const estDate = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const yyyy = estDate.getUTCFullYear();
  const mm = String(estDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(estDate.getUTCDate()).padStart(2, "0");
  const hh = String(estDate.getUTCHours()).padStart(2, "0");
  const min = String(estDate.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function parseEstDatetimeInput(datetimeStr: string): Date {
  return new Date(datetimeStr + ":00-05:00");
}

function estToUtc(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":");
  const hours = Number(timeParts[0]) || 0;
  const minutes = Number(timeParts[1]) || 0;

  const dateTimeStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(
    hours
  ).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

  const utcDate = new Date(dateTimeStr + "Z");
  utcDate.setUTCHours(utcDate.getUTCHours() + 5);
  return utcDate;
}

export function formatEst(d: Date): string {
  const estDate = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const yyyy = estDate.getUTCFullYear();
  const mm = String(estDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(estDate.getUTCDate()).padStart(2, "0");
  const hh = String(estDate.getUTCHours()).padStart(2, "0");
  const min = String(estDate.getUTCMinutes()).padStart(2, "0");
  const ss = String(estDate.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function computeWindowSingleDay(
  dateStr: string,
  startTime: string,
  endTime: string
): { start: Date; end: Date } | null {
  if (!isValidYmd(dateStr)) return null;

  const startTimeStr = startTime || "00:00";
  const endTimeStr = endTime || "00:00";
  const start = estToUtc(dateStr, startTimeStr);
  const end = estToUtc(dateStr, endTimeStr);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export function computeWindowRange(
  startStr: string,
  endStr: string,
  startTime: string,
  endTime: string
): { start: Date; end: Date } | null {
  if (!isValidYmd(startStr) || !isValidYmd(endStr)) return null;

  const startTimeStr = startTime || "00:00";
  const endTimeStr = endTime || "00:00";
  const start = estToUtc(startStr, startTimeStr);
  const end = estToUtc(endStr, endTimeStr);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export function formatWindowPreview(start: Date, end: Date): WindowPreview {
  return {
    headline: "Computed window (EST)",
    body: `${formatEst(start)} EST → ${formatEst(end)} EST`,
  };
}

export function getTodayStr(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getInitialMostRecentSince(): string {
  return dateToEstDatetimeInput(new Date());
}

export interface WindowPreview {
  headline: string;
  body: string;
}

export function getWindowPreview(archivalConfig: ArchivalConfig): WindowPreview | null {
  const { archivalType } = archivalConfig;
  
  if (archivalConfig.archivalType === "singleDay") {
    const singleDayParams = archivalConfig.typeParams as SingleDayParams;
    if (!singleDayParams.date) return null;
    const window = computeWindowSingleDay(
      singleDayParams.date,
      singleDayParams.dateStartTime || "00:00",
      singleDayParams.dateEndTime || "00:00"
    );
    return window ? formatWindowPreview(window.start, window.end) : null;
  }

  if (archivalType === "dateRange") {
    const dateRangeParams = archivalConfig.typeParams as DateRangeParams;
    if (!dateRangeParams.start || !dateRangeParams.end) return null;
    const window = computeWindowRange(
      dateRangeParams.start,
      dateRangeParams.end,
      dateRangeParams.startTime || "00:00",
      dateRangeParams.endTime || "00:00"
    );
    return window ? formatWindowPreview(window.start, window.end) : null;
  }

  if (archivalType === "mostRecent") {
    const mostRecentParams = archivalConfig.typeParams as MostRecentParams;
    if (!mostRecentParams.mostRecentSince) return null;
    const since = parseEstDatetimeInput(mostRecentParams.mostRecentSince);
    if (Number.isNaN(since.getTime())) return null;
    return {
      headline: "Selection window (EST)",
      body: `Most recent ${mostRecentParams.mostRecentCount || 50} items since ${formatEst(since)} EST.`,
    };
  }

  if (archivalType === "urls") {
    const urlsParams = archivalConfig.typeParams as UrlsParams;
    if (!urlsParams.urls) return null;
    const urlCount = urlsParams.urls.length;
    return {
      headline: "Selection window",
      body: `Using explicit URL list (${urlCount} URL${urlCount === 1 ? "" : "s"}).`,
    };
  }

  return null;
}
