"use client";

import { useRef, useEffect } from "react";
import { formatLogTs, levelClass, type LogLevel } from "../utils/logHelpers";

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
}

export default function StatusPanel({ runState, statusText, progress, logs, details }: StatusPanelProps) {
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
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900">
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
            className="h-72 overflow-auto rounded-lg border border-gray-200 bg-black p-4 font-mono text-xs text-gray-100">
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
          <pre className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-900">
            {details || "(none)"}
          </pre>
        </div>
      </div>
    </section>
  );
}
