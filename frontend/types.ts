export type LogLevel = "debug" | "info" | "warn" | "error";
export type RunState = "idle" | "running" | "success" | "error";
export type Source = "instagram" | "twitter" | "tiktok" | "newsletter" | "dailyPrince" | "dailyPrinceIssues";
export type ArchivalType = "singleDay" | "dateRange" | "urls" | "mostRecent";

export interface LogLine {
  ts: number;
  level: LogLevel;
  msg: string;
}

export interface Job {
  id: string;
  status: RunState;
  downloadUrl?: string;
  logs: LogLine[];
  createdAt: number;
  source: Source;
  archivalType: ArchivalType;
}

export interface JobsMap {
  [key: string]: Job;
}

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
  singleDayParams?: SingleDayParams;
  dateRangeParams?: DateRangeParams;
  urlsParams?: UrlsParams;
  mostRecentParams?: MostRecentParams;
  authToken: string;
  source: Source;
  archivalType: ArchivalType;
}

export interface getJobsResponse {
  jobs: JobsMap;
  status: "success" | "error";
  message: string;
}

export interface getJobResponse {
  job: Job;
  status: "success" | "error";
  message: string;
}

export interface postJobResponse {
  job: Job;
  status: "success" | "error";
  message: string;
}
