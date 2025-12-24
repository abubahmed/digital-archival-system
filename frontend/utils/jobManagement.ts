import type { PastJob, RunState, Source, ArchivalType } from "../types";
import type { LogLine } from "../types";

/**
 * Job list management utilities
 */
export const jobListUtils = {
  /**
   * Add a new job to the beginning of the jobs list
   */
  addJob: (jobs: PastJob[], job: PastJob): PastJob[] => {
    return [job, ...jobs];
  },

  /**
   * Find a job by its ID
   */
  findJob: (jobs: PastJob[], jobId: string): PastJob | undefined => {
    return jobs.find((j) => j.id === jobId);
  },

  /**
   * Update a job by ID with a partial update
   */
  updateJob: (jobs: PastJob[], jobId: string, updates: Partial<PastJob>): PastJob[] => {
    return jobs.map((job) => (job.id === jobId ? { ...job, ...updates } : job));
  },

  /**
   * Update a job's state, statusText, and logs
   */
  updateJobState: (
    jobs: PastJob[],
    jobId: string,
    state: RunState,
    statusText: string,
    logs: LogLine[],
    downloadUrl?: string
  ): PastJob[] => {
    return jobListUtils.updateJob(jobs, jobId, {
      state,
      statusText,
      logs,
      downloadUrl,
    });
  },

  /**
   * Add a log entry to a job
   */
  appendLog: (jobs: PastJob[], jobId: string, log: LogLine): PastJob[] => {
    const job = jobListUtils.findJob(jobs, jobId);
    if (!job) return jobs;
    const updatedLogs = [...job.logs, log];
    return jobListUtils.updateJob(jobs, jobId, { logs: updatedLogs });
  },

  /**
   * Create a new job object
   */
  createJob: (
    id: string,
    createdAt: number,
    source: Source,
    archivalType: ArchivalType,
    state: RunState = "running",
    statusText: string = "Running...",
    logs: LogLine[] = [],
    downloadUrl?: string
  ): PastJob => {
    return {
      id,
      createdAt,
      config: { source, archivalType },
      state,
      statusText,
      logs,
      downloadUrl,
    };
  },
};
