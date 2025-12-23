export function isValidYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function dateToYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function dateToLocalDatetimeInput(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// Convert EST time to UTC Date
// EST is UTC-5, EDT (daylight saving) is UTC-4
// For simplicity, we'll use UTC-5 (EST) year-round
function estToUtc(dateStr: string, timeStr: string): Date {
  // Parse date and time
  const [year, month, day] = dateStr.split("-").map(Number);
  // Time input gives us "HH:MM", we need to handle that
  const timeParts = timeStr.split(":");
  const hours = Number(timeParts[0]) || 0;
  const minutes = Number(timeParts[1]) || 0;
  
  // Create a date string in ISO format (treating input as EST)
  const dateTimeStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  
  // Create date as if it's UTC (this gives us the UTC time that looks like the EST time)
  const utcDate = new Date(dateTimeStr + "Z");
  // EST is UTC-5, so to convert EST to UTC, we add 5 hours
  // Example: 00:00 EST = 05:00 UTC
  utcDate.setUTCHours(utcDate.getUTCHours() + 5);
  
  return utcDate;
}

export function computeWindowSingleDay(dateStr: string, startTime: string, endTime: string) {
  if (!isValidYmd(dateStr)) return null;
  
  // Default to midnight EST if times not provided
  const startTimeStr = startTime || "00:00:00";
  const endTimeStr = endTime || "00:00:00";
  
  // Start: previous day at startTime EST
  const prevDay = new Date(dateStr);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDayStr = dateToYmd(prevDay);
  const start = estToUtc(prevDayStr, startTimeStr);
  
  // End: selected day at endTime EST
  const end = estToUtc(dateStr, endTimeStr);
  
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export function computeWindowRange(startStr: string, endStr: string, startTime: string, endTime: string) {
  if (!isValidYmd(startStr) || !isValidYmd(endStr)) return null;
  
  // Default to midnight EST if times not provided
  const startTimeStr = startTime || "00:00:00";
  const endTimeStr = endTime || "00:00:00";
  
  // Start: start date - 1 day at startTime EST
  const prevStartDay = new Date(startStr);
  prevStartDay.setDate(prevStartDay.getDate() - 1);
  const prevStartDayStr = dateToYmd(prevStartDay);
  const start = estToUtc(prevStartDayStr, startTimeStr);
  
  // End: end date at endTime EST
  const end = estToUtc(endStr, endTimeStr);
  
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export function formatLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function formatWindowPreview(start: Date, end: Date) {
  return {
    headline: "Computed window (EST)",
    body: `${formatLocal(start)} EST → ${formatLocal(end)} EST`,
  };
}

export function timeToInputValue(time: string): string {
  // Convert "HH:MM:SS" or "HH:MM" to "HH:MM" for time input
  return time.split(":").slice(0, 2).join(":");
}

