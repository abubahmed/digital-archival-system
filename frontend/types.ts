/**
 * Types for the archival system.
 *
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 *
 * @file types.ts
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type RunState = "idle" | "running" | "success" | "error";
export type Source = "instagram" | "twitter" | "tiktok" | "newsletter" | "dailyPrince" | "dailyPrinceIssues";
export type ArchivalType = "singleDay" | "dateRange" | "urls" | "mostRecent";

// Interface for log line in debug log
export interface LogLine {
  timestamp: number;
  level: LogLevel;
  message: string;
}

// Interface for a job
export interface Job {
  jobId: string;
  state: RunState;
  downloadUrl?: string;
  logs: LogLine[];
  createdAt: number;
  source: Source;
  archivalType: ArchivalType;
}

// Interface for a list of jobs
export type Jobs = Record<string, Job>;

// Interface for single day parameters
export interface SingleDayParams {
  date: string;
  dateStartTime: string;
  dateEndTime: string;
}

// Interface for date range parameters
export interface DateRangeParams {
  start: string;
  end: string;
  startTime: string;
  endTime: string;
}

// Interface for URLs parameters
export interface UrlsParams {
  urls: string[];
}

// Interface for most recent parameters
export interface MostRecentParams {
  mostRecentSince: string;
  mostRecentCount: number;
}

// Interface for archival configuration
export interface ArchivalConfig {
  typeParams: SingleDayParams | DateRangeParams | UrlsParams | MostRecentParams;
  authToken: string;
  source: Source;
  archivalType: ArchivalType;
}

// Interface for get jobs API response
export interface getJobsResponse {
  jobs: Jobs;
  error?: string;
}

// Interface for get job API response
export interface getJobResponse {
  job: Job;
  error?: string;
}

// Interface for create job API response
export interface createJobResponse {
  job: Job;
  error?: string;
}
