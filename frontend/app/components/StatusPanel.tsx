"use client";

import { useRef, useEffect } from "react";
import { formatLogTs, levelClass, type LogLevel } from "../utils/logHelpers";
import type { PastJob } from "../page";

export interface LogLine {
  ts: number;
  level: LogLevel;
  msg: string;
}

type RunState = "idle" | "running" | "success" | "error";

interface StatusPanelProps {
  runState: RunState;
  statusText: string;
  progress: number;
  logs: LogLine[];
  details: string;
  pastJobs: PastJob[];
  onOpenJob: (job: PastJob) => void;
}

export default function StatusPanel({
  runState,
  statusText,
  progress,
  logs,
  details,
  pastJobs,
  onOpenJob,
}: StatusPanelProps) {
  const logViewportRef = useRef<HTMLDivElement | null>(null);
  const isRunning = runState === "running";

  // Auto-scroll logs
  useEffect(() => {
    const el = logViewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Run Status</h2>
        <p className="mt-1 text-sm text-gray-600">Monitor progress and inspect debug output.</p>
      </div>

      <div className="space-y-6 px-6 py-6">
        {/* Status */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900">Status</div>
            <div className="text-xs text-gray-600">
              {runState === "running"
                ? "Running"
                : runState === "success"
                ? "Success"
                : runState === "error"
                ? "Error"
                : "Idle"}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-colors">
            {statusText}
          </div>

          {/* Progress Bar */}
          {(isRunning || runState === "success" || runState === "error") && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    runState === "error" ? "bg-red-600" : runState === "success" ? "bg-green-600" : "bg-black"
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>
              <div className="mt-1 text-right text-xs text-gray-600">{Math.round(progress)}%</div>
            </div>
          )}
        </div>

        {/* Debug Logs */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900">Live debug logs</div>
            <div className="text-xs text-gray-600">
              {logs.length} line{logs.length === 1 ? "" : "s"}
            </div>
          </div>
          <div
            ref={logViewportRef}
            className="h-72 overflow-auto rounded-lg border border-gray-200 bg-black px-4 py-3 font-mono text-xs text-gray-100">
            {logs.length === 0 ? (
              <div className="text-gray-400">No logs yet. Click "Generate Archive" to start.</div>
            ) : (
              logs.map((l, idx) => (
                <div key={`${l.ts}-${idx}`} className="whitespace-pre-wrap break-words">
                  <span className="text-gray-400">{formatLogTs(l.ts)}</span>{" "}
                  <span className={levelClass(l.level)}>[{l.level}]</span> {l.msg}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Details */}
        <div>
          <div className="mb-2 text-sm font-medium text-gray-900">Details</div>
          <div className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900">
            {details || "(none)"}
          </div>
        </div>

        {/* Past Jobs */}
        <div>
          <div className="mb-2 text-sm font-medium text-gray-900">Past Jobs</div>
          {pastJobs.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              No past jobs yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {pastJobs.map((job) => {
                const date = new Date(job.createdAt);
                const dateStr = date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const timeStr = date.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={job.id}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {job.config.source} - {job.config.archivalType}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {dateStr} at {timeStr}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenJob(job)}
                          className="rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors whitespace-nowrap">
                          Open
                        </button>
                        {job.downloadUrl && (
                          <a
                            href={job.downloadUrl}
                            download
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap">
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
