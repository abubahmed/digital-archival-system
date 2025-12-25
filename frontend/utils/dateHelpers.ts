/**
 * Date helpers.
 *
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 *
 * @file dateHelpers.ts
 */

import { ArchivalConfig, DateRangeParams, MostRecentParams, SingleDayParams, UrlsParams } from "@/types";

/**
 * Checks if a string is a valid YYYY-MM-DD date.
 *
 * @param {string} s - The string to check.
 *
 * @returns {boolean} True if the string is a valid YYYY-MM-DD date, false otherwise.
 */
export function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Converts a date to a EST datetime input string.
 *
 * @param {Date} d - The date to convert.
 *
 * @returns {string} The EST datetime input string.
 */
export function dateToEstDatetimeInput(d: Date): string {
  const estDate = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const yyyy = estDate.getUTCFullYear();
  const mm = String(estDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(estDate.getUTCDate()).padStart(2, "0");
  const hh = String(estDate.getUTCHours()).padStart(2, "0");
  const min = String(estDate.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Parses a EST datetime input string to a date.
 *
 * @param {string} datetimeStr - The EST datetime input string.
 *
 * @returns {Date} The date.
 */
export function parseEstDatetimeInput(datetimeStr: string): Date {
  return new Date(datetimeStr + ":00-05:00");
}

/**
 * Converts a EST datetime string to a UTC date.
 *
 * @param {string} dateStr - The EST date string.
 * @param {string} timeStr - The EST time string.
 *
 * @returns {Date} The UTC date.
 */
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

/**
 * Formats a date as a EST datetime string.
 *
 * @param {Date} d - The date to format.
 *
 * @returns {string} The formatted EST datetime string.
 */
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

/**
 * Computes a single day window.
 *
 * @param {string} dateStr - The date string.
 * @param {string} startTime - The start time string.
 * @param {string} endTime - The end time string.
 *
 * @returns {Date} The computed window.
 */
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

/**
 * Computes a date range window.
 *
 * @param {string} startStr - The start date string.
 * @param {string} endStr - The end date string.
 * @param {string} startTime - The start time string.
 * @param {string} endTime - The end time string.
 *
 * @returns {Date} The computed window.
 */
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

/**
 * Formats a window preview.
 *
 * @param {Date} start - The start date.
 * @param {Date} end - The end date.
 *
 * @returns {WindowPreview} The formatted window preview.
 */
export function formatWindowPreview(start: Date, end: Date): WindowPreview {
  return {
    headline: "Computed window (EST)",
    body: `${formatEst(start)} EST → ${formatEst(end)} EST`,
  };
}

/**
 * Gets the today's date string.
 *
 * @returns {string} The today's date string.
 */
export function getTodayStr(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Gets the initial most recent since.
 *
 * @returns {string} The initial most recent since.
 */
export function getInitialMostRecentSince(): string {
  return dateToEstDatetimeInput(new Date());
}

export interface WindowPreview {
  headline: string;
  body: string;
}

/**
 * Gets a window preview.
 *
 * @param {ArchivalConfig} archivalConfig - The archival configuration.
 *
 * @returns {WindowPreview} The window preview.
 */
export function getWindowPreview(archivalConfig: ArchivalConfig): WindowPreview | null {
  const { archivalType } = archivalConfig;

  // Create selection window if archival type is single day
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

  // Create selection window if archival type is date range
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

  // Create selection window if archival type is most recent
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

  // Create selection window if archival type is URLs
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
