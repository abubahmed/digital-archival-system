import type { Source, ArchivalType, RunState } from "../types";
import type { LogLevel } from "./logHelpers";

/**
 * Configuration for the archival process
 */
export interface ArchivalConfig {
  source: Source;
  archivalType: ArchivalType;
  authToken: string;
  // Date configuration
  date?: string;
  dateStartTime?: string;
  dateEndTime?: string;
  start?: string;
  end?: string;
  startTime?: string;
  endTime?: string;
  // URL configuration
  urls?: string[];
  // Most recent configuration
  mostRecentCount?: number;
  mostRecentSince?: string;
}

/**
 * Callback function for logging during archival process
 */
export type LogCallback = (level: LogLevel, message: string) => void;

/**
 * Sleep utility function
 */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Result of the archival process
 */
export interface ArchivalResult {
  downloadUrl?: string;
  state: RunState;
  statusText: string;
}

/**
 * Fake archival process - simulates the archival workflow.
 *
 * This function can be easily replaced with a real archival implementation.
 * The function should determine its own success/failure state and provide
 * appropriate status messages.
 *
 * @param config - Configuration for the archival process
 * @param logCallback - Callback function to receive log messages during the process
 * @returns Promise that resolves with the archival result (downloadUrl, state, statusText), or rejects with an error
 */
export async function runFakeArchivalProcess(
  config: ArchivalConfig,
  logCallback: LogCallback
): Promise<ArchivalResult> {
  // Simulate archive process
  logCallback("info", "Starting archive process...");
  await sleep(300);

  logCallback("debug", "Validating inputs...");
  await sleep(250);

  logCallback("info", "Fetching items...");
  await sleep(300);

  logCallback("info", "Processing items...");
  await sleep(300);

  logCallback("info", "Preparing a browser download");
  await sleep(250);

  logCallback("info", "Archive process complete.");

  // Return the result with state and status text
  // In a real implementation, this would determine success/failure based on actual results
  return {
    downloadUrl: "https://www.google.com",
    state: "success",
    statusText: "Done (simulated).",
  };
}

export async function runArchivalProcess(config: ArchivalConfig, logCallback: LogCallback): Promise<ArchivalResult> {
  // TODO: Implement the real archival process
  return {
    downloadUrl: "https://www.google.com",
    state: "success",
    statusText: "Done (simulated).",
  };
}
