import type { ArchivalConfig, RunState, Job } from "../types";
import { generateJobId } from "./jobHelpers";

export async function startArchivalProcessFake(config: ArchivalConfig): Promise<Job> {
  const jobId = generateJobId(config.source, config.archivalType, config.createdAt);
  const job: Job = {
    id: jobId,
    status: "success" as RunState,
    downloadUrl: "https://www.google.com",
    logs: [{ ts: Date.now(), level: "info", msg: "Archive process complete." }],
    createdAt: config.createdAt,
    source: config.source,
    archivalType: config.archivalType,
  };
  return job;
}

export async function startArchivalProcess(config: ArchivalConfig): Promise<Job> {
  const jobId = generateJobId(config.source, config.archivalType, config.createdAt);
  const job: Job = {
    id: jobId,
    status: "success" as RunState,
    downloadUrl: "https://www.google.com",
    logs: [{ ts: Date.now(), level: "info", msg: "Archive process complete." }],
    createdAt: config.createdAt,
    source: config.source,
    archivalType: config.archivalType,
  };
  return job;
}
