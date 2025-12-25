import { isValidYmd, parseEstDatetimeInput } from "./dateHelpers";
import type { ArchivalType } from "../app/page";

function validateSingleDayParams(singleDayParams: {
  date: string;
  dateStartTime: string;
  dateEndTime: string;
}): string | null {
  if (!isValidYmd(singleDayParams.date)) {
    return "Single-day selected, but date is invalid.";
  }
  return null;
}

function validateDateRangeParams(dateRangeParams: {
  start: string;
  end: string;
  startTime: string;
  endTime: string;
}): string | null {
  if (!isValidYmd(dateRangeParams.start) || !isValidYmd(dateRangeParams.end)) {
    return "Date-range selected, but start/end are invalid.";
  }
  if (dateRangeParams.start > dateRangeParams.end) {
    return "Date-range selected, but start date is after end date.";
  }
  return null;
}

function validateUrlsParams(urlsParams: { urls: string[] }): string | null {
  if (urlsParams.urls.length === 0) {
    return "URL list selected, but no URLs were provided.";
  }
  return null;
}

function validateMostRecentParams(mostRecentParams: {
  mostRecentSince: string;
  mostRecentCount: number;
}): string | null {
  if (!mostRecentParams.mostRecentSince) {
    return "Most-recent selected, but the starting date/time is invalid.";
  }
  try {
    const since = parseEstDatetimeInput(mostRecentParams.mostRecentSince);
    if (Number.isNaN(since.getTime())) {
      return "Most-recent selected, but the starting date/time is invalid.";
    }
  } catch {
    return "Most-recent selected, but the starting date/time is invalid.";
  }
  if (!Number.isFinite(mostRecentParams.mostRecentCount) || mostRecentParams.mostRecentCount <= 0) {
    return "Most-recent selected, but item count must be a positive number.";
  }
  return null;
}

export function validateBeforeRun(
  archivalType: ArchivalType,
  authToken: string,
  singleDayParams: {
    date: string;
    dateStartTime: string;
    dateEndTime: string;
  },
  dateRangeParams: {
    start: string;
    end: string;
    startTime: string;
    endTime: string;
  },
  urlsParams: {
    urls: string[];
  },
  mostRecentParams: {
    mostRecentSince: string;
    mostRecentCount: number;
  }
) {
  if (!archivalType) return "Archival type is required.";
  if (!authToken) return "API Key is required.";

  switch (archivalType) {
    case "singleDay":
      return validateSingleDayParams(singleDayParams);
    case "dateRange":
      return validateDateRangeParams(dateRangeParams);
    case "urls":
      return validateUrlsParams(urlsParams);
    case "mostRecent": {
      return validateMostRecentParams(mostRecentParams);
    }
  }
}
