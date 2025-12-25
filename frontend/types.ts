export type LogLevel = "debug" | "info" | "warn" | "error";
export type RunState = "idle" | "running" | "success" | "error";
export type Source = "instagram" | "twitter" | "tiktok" | "newsletter" | "dailyPrince" | "dailyPrinceIssues";
export type ArchivalType = "singleDay" | "dateRange" | "urls" | "mostRecent";

export interface LogLine {
  timestamp: number;
  level: LogLevel;
  message: string;
}

export interface Job {
  jobId: string;
  state: RunState;
  downloadUrl?: string;
  logs: LogLine[];
  createdAt: number;
  source: Source;
  archivalType: ArchivalType;
}

export type Jobs = Record<string, Job>;

export interface SingleDayParams {
  date: string;
  dateStartTime: string;
  dateEndTime: string;
}

export interface DateRangeParams {
  start: string;
  end: string;
  startTime: string;
  endTime: string;
}

export interface UrlsParams {
  urls: string[];
}

export interface MostRecentParams {
  mostRecentSince: string;
  mostRecentCount: number;
}

export interface ArchivalConfig {
  typeParams: SingleDayParams | DateRangeParams | UrlsParams | MostRecentParams;
  authToken: string;
  source: Source;
  archivalType: ArchivalType;
}

export interface getJobsResponse {
  jobs: Jobs;
  error?: string;
}

export interface getJobResponse {
  job: Job;
  error?: string;
}

export interface createJobResponse {
  job: Job;
  error?: string;
}
