import type { LogLevel } from "./utils/logHelpers";

export type Source = "instagram" | "twitter" | "tiktok" | "newsletter" | "dailyPrince" | "dailyPrinceIssues";
export type ArchivalType = "singleDay" | "dateRange" | "urls" | "mostRecent";
export type Delivery = "download" | "email";
export type Schedule = "now" | "later";
export type RunState = "idle" | "running" | "success" | "error";

export interface LogLine {
  ts: number;
  level: LogLevel;
  msg: string;
}

export interface CurrentJob {
  state: RunState;
  statusText: string;
  progress: number;
  logs: LogLine[];
  details: string;
}

export interface PastJob {
  id: string;
  createdAt: number;
  config: {
    source: Source;
    archivalType: ArchivalType;
    delivery: Delivery;
  };
  downloadUrl?: string;
  state: RunState;
  statusText: string;
  progress: number;
  logs: LogLine[];
  details: string;
}
