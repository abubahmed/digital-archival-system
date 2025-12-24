import { useState, useCallback, useMemo } from "react";
import type { PastJob, RunState } from "../types";
import type { LogLine } from "../types";
import { jobListUtils } from "../utils/jobManagement";
import type { LogLevel } from "../utils/logHelpers";

/**
 * Custom hook for managing jobs state and operations
 */
export function useJobManagement(initialJobs: PastJob[] = []) {
  const [allJobs, setAllJobs] = useState<PastJob[]>(initialJobs);
  const [displayedJobId, setDisplayedJobId] = useState<string | null>(null);

  // Get the currently displayed job
  const displayedJob = useMemo(() => {
    if (!displayedJobId) return null;
    return jobListUtils.findJob(allJobs, displayedJobId) ?? null;
  }, [displayedJobId, allJobs]);

  // Derive run state from displayed job
  const runState: RunState = displayedJob?.state ?? "idle";
  const statusText: string = displayedJob?.statusText ?? "Ready.";
  const logs: LogLine[] = displayedJob?.logs ?? [];

  // Job operations
  const addJob = useCallback((job: PastJob) => {
    setAllJobs((prev) => jobListUtils.addJob(prev, job));
  }, []);

  const appendLog = useCallback((jobId: string, level: LogLevel, msg: string) => {
    const newLog: LogLine = { ts: Date.now(), level, msg };
    setAllJobs((prev) => jobListUtils.appendLog(prev, jobId, newLog));
  }, []);

  const openJob = useCallback((job: PastJob) => {
    setDisplayedJobId(job.id);
  }, []);

  const createJobLogFunction = useCallback(
    (jobId: string) => {
      return (level: LogLevel, msg: string) => {
        appendLog(jobId, level, msg);
      };
    },
    [appendLog]
  );

  return {
    // State
    allJobs,
    displayedJobId,
    displayedJob,
    runState,
    statusText,
    logs,

    // Actions
    setAllJobs,
    addJob,
    openJob,
    createJobLogFunction,
  };
}
