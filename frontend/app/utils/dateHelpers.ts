export function isValidYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function dateToYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Convert UTC Date to EST datetime input string (for HTML datetime-local inputs)
// Note: datetime-local inputs don't support timezones, so we format as EST
export function dateToEstDatetimeInput(d: Date): string {
  // Convert UTC to EST (subtract 5 hours)
  const estDate = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const yyyy = estDate.getUTCFullYear();
  const mm = String(estDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(estDate.getUTCDate()).padStart(2, "0");
  const hh = String(estDate.getUTCHours()).padStart(2, "0");
  const min = String(estDate.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// Parse datetime-local input string as EST and convert to UTC Date
// datetime-local inputs don't have timezone info, so we treat them as EST
export function parseEstDatetimeInput(datetimeStr: string): Date {
  // Append EST offset (-05:00) to treat the input as EST
  // Then convert to UTC
  return new Date(datetimeStr + ":00-05:00");
}

// Convert EST time to UTC Date
// EST is UTC-5 (we use EST year-round, ignoring EDT for simplicity)
function estToUtc(dateStr: string, timeStr: string): Date {
  // Parse date and time
  const [year, month, day] = dateStr.split("-").map(Number);
  // Time input gives us "HH:MM", we need to handle that
  const timeParts = timeStr.split(":");
  const hours = Number(timeParts[0]) || 0;
  const minutes = Number(timeParts[1]) || 0;

  // Create a date string in ISO format (treating input as EST)
  const dateTimeStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(
    hours
  ).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

  // Create date as UTC first
  const utcDate = new Date(dateTimeStr + "Z");
  // EST is UTC-5, so to convert EST to UTC, we add 5 hours
  // Example: 00:00 EST = 05:00 UTC
  utcDate.setUTCHours(utcDate.getUTCHours() + 5);

  return utcDate;
}

// Convert UTC Date to EST string for display
export function formatEst(d: Date): string {
  // Convert UTC to EST (subtract 5 hours)
  const estDate = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const yyyy = estDate.getUTCFullYear();
  const mm = String(estDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(estDate.getUTCDate()).padStart(2, "0");
  const hh = String(estDate.getUTCHours()).padStart(2, "0");
  const min = String(estDate.getUTCMinutes()).padStart(2, "0");
  const ss = String(estDate.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function computeWindowSingleDay(dateStr: string, startTime: string, endTime: string) {
  if (!isValidYmd(dateStr)) return null;

  // Default to midnight EST if times not provided
  const startTimeStr = startTime || "00:00";
  const endTimeStr = endTime || "00:00";

  // Start: selected day at startTime EST
  const start = estToUtc(dateStr, startTimeStr);

  // End: selected day at endTime EST
  const end = estToUtc(dateStr, endTimeStr);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export function computeWindowRange(startStr: string, endStr: string, startTime: string, endTime: string) {
  if (!isValidYmd(startStr) || !isValidYmd(endStr)) return null;

  // Default to midnight EST if times not provided
  const startTimeStr = startTime || "00:00";
  const endTimeStr = endTime || "00:00";

  // Start: start date at startTime EST
  const start = estToUtc(startStr, startTimeStr);

  // End: end date at endTime EST
  const end = estToUtc(endStr, endTimeStr);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export function formatWindowPreview(start: Date, end: Date) {
  return {
    headline: "Computed window (EST)",
    body: `${formatEst(start)} EST → ${formatEst(end)} EST`,
  };
}

export function timeToInputValue(time: string): string {
  // Convert "HH:MM:SS" or "HH:MM" to "HH:MM" for time input
  return time.split(":").slice(0, 2).join(":");
}
