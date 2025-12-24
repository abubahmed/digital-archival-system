"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RadioCard from "../components/RadioCard";
import { getTodayStr, getInitialMostRecentSince, getWindowPreview } from "../utils/dateHelpers";
import { formatLogTs, levelClass } from "../utils/logHelpers";
import { validateBeforeRun } from "../utils/validation";
import { generateJobId } from "../utils/jobHelpers";
import { useJobManagement } from "../hooks/useJobManagement";
import { jobListUtils } from "../utils/jobManagement";
import type { Source, ArchivalType, PastJob } from "../types";
import { getInitialPastJobs } from "../data";
import { runFakeArchivalProcess, type ArchivalConfig } from "../utils/archivalProcess";

const LOCAL_STORAGE_KEYS = {
  REMEMBER_AUTH: "archive_ui_remember_auth",
  AUTH_TOKEN: "archive_ui_auth_token",
};

export default function Page() {
  // Core configuration
  const [source, setSource] = useState<Source>("dailyPrince");
  const [archivalType, setArchivalType] = useState<ArchivalType>("singleDay");

  // Dates
  const todayStr = getTodayStr();

  const [date, setDate] = useState<string>(todayStr);
  const [dateStartTime, setDateStartTime] = useState<string>("00:00");
  const [dateEndTime, setDateEndTime] = useState<string>("00:00");
  const [start, setStart] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>("00:00");
  const [end, setEnd] = useState<string>(todayStr);
  const [endTime, setEndTime] = useState<string>("00:00");

  // URL mode
  const [urlsText, setUrlsText] = useState("");

  // Most recent mode
  const [mostRecentCount, setMostRecentCount] = useState<number>(50);
  const [mostRecentSince, setMostRecentSince] = useState<string>(getInitialMostRecentSince());

  // Auth
  const [authToken, setAuthToken] = useState<string>("");
  const [rememberAuth, setRememberAuth] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(LOCAL_STORAGE_KEYS.REMEMBER_AUTH);
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  // Job management hook
  const {
    allJobs,
    displayedJobId,
    displayedJob,
    runState,
    statusText,
    logs,
    addJob,
    openJob,
    createJobLogFunction,
    setAllJobs,
  } = useJobManagement([]);

  // Log viewport ref for auto-scrolling
  const logViewportRef = useRef<HTMLDivElement | null>(null);

  // Initialize allJobs on client side only to avoid hydration mismatch
  useEffect(() => {
    setAllJobs(getInitialPastJobs());
  }, [setAllJobs]);

  // Auto-scroll logs
  useEffect(() => {
    const el = logViewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  const isRunning = runState === "running";

  // Normalize URLs
  const normalizedUrls = useMemo(() => {
    return urlsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [urlsText]);

  // Window selection preview
  const windowPreview = useMemo(
    () =>
      getWindowPreview(archivalType, {
        date,
        dateStartTime,
        dateEndTime,
        start,
        end,
        startTime,
        endTime,
        mostRecentSince,
        mostRecentCount,
        normalizedUrlsLength: normalizedUrls.length,
      }),
    [
      archivalType,
      date,
      dateStartTime,
      dateEndTime,
      start,
      end,
      startTime,
      endTime,
      mostRecentSince,
      mostRecentCount,
      normalizedUrls.length,
    ]
  );

  // Save rememberAuth preference to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEYS.REMEMBER_AUTH, String(rememberAuth));
    } catch {
      // ignore
    }
  }, [rememberAuth]);

  // Load and save auth token from/to localStorage
  const hasLoadedToken = useRef(false);
  useEffect(() => {
    try {
      if (rememberAuth) {
        // Load on mount if not already loaded
        if (!hasLoadedToken.current) {
          const saved = window.localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
          if (saved) {
            setAuthToken(saved);
          }
          hasLoadedToken.current = true;
        } else if (authToken) {
          // Save when authToken changes (after initial load)
          window.localStorage.setItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN, authToken);
        }
      } else {
        // Remove when rememberAuth is disabled
        window.localStorage.removeItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
        hasLoadedToken.current = false;
      }
    } catch {
      // ignore
    }
  }, [authToken, rememberAuth]);

  const validationError = useMemo(
    () =>
      validateBeforeRun(archivalType, date, start, end, normalizedUrls, mostRecentSince, mostRecentCount, authToken),
    [archivalType, date, start, end, normalizedUrls, mostRecentSince, mostRecentCount, authToken]
  );

  async function generateArchive() {
    if (validationError) {
      // For validation errors, we don't create a job, just show the error
      // The error is already displayed in the UI via validationError
      return;
    }

    // Generate job ID at the start
    const createdAt = Date.now();
    const jobId = generateJobId(source, archivalType, createdAt);

    // Create and add job to list
    const newJob = jobListUtils.createJob(jobId, createdAt, source, archivalType, "running", "Running...", []);
    addJob(newJob);
    openJob(newJob);

    // Create job-specific log function
    const pushJobLog = createJobLogFunction(jobId);
    pushJobLog("info", "Archive job configured.");
    pushJobLog("info", `Source: ${source}, Type: ${archivalType}`);

    try {
      // Prepare archival configuration
      const archivalConfig: ArchivalConfig = {
        source,
        archivalType,
        authToken,
        date,
        dateStartTime,
        dateEndTime,
        start,
        end,
        startTime,
        endTime,
        urls: normalizedUrls,
        mostRecentCount,
        mostRecentSince,
      };

      // Run the archival process
      const result = await runFakeArchivalProcess(archivalConfig, pushJobLog);

      // Update job with final state - use functional update to get latest logs
      setAllJobs((prev) => {
        const currentJob = jobListUtils.findJob(prev, jobId);
        const currentLogs = currentJob?.logs ?? [];
        return jobListUtils.updateJobState(
          prev,
          jobId,
          result.state,
          result.statusText,
          currentLogs,
          result.downloadUrl
        );
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      pushJobLog("error", msg);

      // Update job with error state - use functional update to get latest logs
      setAllJobs((prev) => {
        const currentJob = jobListUtils.findJob(prev, jobId);
        const currentLogs = currentJob?.logs ?? [];
        const errorLogs = [...currentLogs, { ts: Date.now(), level: "error" as const, msg }];
        return jobListUtils.updateJobState(prev, jobId, "error", "Failed.", errorLogs, undefined);
      });
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white via-gray-50 to-gray-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 pb-6 sm:px-6 lg:px-8">
        <header className="border-gray-200 pb-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Daily Prince Archival</h1>
            <p className="text-base text-gray-700 leading-relaxed">
              Configure and generate archives from various sources. All times are in EST (Eastern Standard Time). Data
              sources include Instagram, Twitter / X, TikTok, Newsletter, Daily Prince website, and Daily Prince website
              + newsletter (issues). Archival methods include single day, date range, certain URLs, and most recent.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Configuration Panel */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Create a new archive</h2>
              <p className="mt-1 text-sm text-gray-600">Select source and archival type, then configure details.</p>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* Auth */}
              <div>
                <div className="mb-2">
                  <div className="text-sm font-medium text-gray-900">API Key</div>
                </div>
                <input
                  id="token"
                  type="password"
                  className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Paste token here"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  autoComplete="off"
                  required
                />
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={rememberAuth}
                    onChange={(e) => setRememberAuth(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                  Remember token in this browser (localStorage)
                </label>
              </div>

              {/* Source Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900" htmlFor="source">
                  Source of archival data
                </label>
                <select
                  id="source"
                  className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={source}
                  onChange={(e) => setSource(e.target.value as Source)}>
                  <option value="instagram">Instagram</option>
                  <option value="twitter">Twitter / X</option>
                  <option value="tiktok">TikTok</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="dailyPrince">Daily Prince website</option>
                  <option value="dailyPrinceIssues">Daily Prince website + newsletter (issues)</option>
                </select>
              </div>

              {/* Archival Type */}
              <div>
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-900">Type of archival</div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <RadioCard
                    name="archivalType"
                    value="singleDay"
                    checked={archivalType === "singleDay"}
                    onChange={() => setArchivalType("singleDay")}
                    title="Single day"
                    subtitle="Start time → end time of selected day (EST)"
                  />
                  <RadioCard
                    name="archivalType"
                    value="dateRange"
                    checked={archivalType === "dateRange"}
                    onChange={() => setArchivalType("dateRange")}
                    title="Date range"
                    subtitle="Start time of start day → end time of end day (EST)"
                  />
                  <RadioCard
                    name="archivalType"
                    value="urls"
                    checked={archivalType === "urls"}
                    onChange={() => setArchivalType("urls")}
                    title="Certain URLs"
                    subtitle="Explicit list (one per line)"
                  />
                  <RadioCard
                    name="archivalType"
                    value="mostRecent"
                    checked={archivalType === "mostRecent"}
                    onChange={() => setArchivalType("mostRecent")}
                    title="Most recent items"
                    subtitle="Latest X items since a date/time"
                  />
                </div>
              </div>

              {/* Selection Details */}
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-900">Selection details</div>
                </div>

                {archivalType === "singleDay" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700" htmlFor="date">
                        Date
                      </label>
                      <input
                        id="date"
                        type="date"
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        max={todayStr}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700" htmlFor="dateStartTime">
                          Start time (EST)
                        </label>
                        <input
                          id="dateStartTime"
                          type="time"
                          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={dateStartTime}
                          onChange={(e) => setDateStartTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700" htmlFor="dateEndTime">
                          End time (EST)
                        </label>
                        <input
                          id="dateEndTime"
                          type="time"
                          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={dateEndTime}
                          onChange={(e) => setDateEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {archivalType === "dateRange" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700" htmlFor="start">
                          Start date
                        </label>
                        <input
                          id="start"
                          type="date"
                          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={start}
                          onChange={(e) => setStart(e.target.value)}
                          max={end || todayStr}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700" htmlFor="end">
                          End date
                        </label>
                        <input
                          id="end"
                          type="date"
                          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={end}
                          onChange={(e) => setEnd(e.target.value)}
                          min={start}
                          max={todayStr}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700" htmlFor="startTime">
                          Start time (EST)
                        </label>
                        <input
                          id="startTime"
                          type="time"
                          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700" htmlFor="endTime">
                          End time (EST)
                        </label>
                        <input
                          id="endTime"
                          type="time"
                          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {archivalType === "urls" && (
                  <div>
                    <div className="mb-2">
                      <label className="block text-xs font-medium text-gray-700" htmlFor="urls">
                        URLs (one per line)
                      </label>
                    </div>
                    <textarea
                      id="urls"
                      className="block min-h-32 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-mono text-xs text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="https://example.com/post/123&#10;https://example.com/post/456"
                      value={urlsText}
                      onChange={(e) => setUrlsText(e.target.value)}
                    />
                  </div>
                )}

                {archivalType === "mostRecent" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700" htmlFor="count">
                        Most recent X items
                      </label>
                      <input
                        id="count"
                        type="number"
                        min={1}
                        step={1}
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={mostRecentCount}
                        onChange={(e) => setMostRecentCount(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700" htmlFor="since">
                        Since (EST datetime)
                      </label>
                      <input
                        id="since"
                        type="datetime-local"
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={mostRecentSince}
                        onChange={(e) => setMostRecentSince(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {windowPreview && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 transition-colors">
                    <div className="text-sm font-medium text-gray-700">{windowPreview.headline}</div>
                    <div className="mt-1 text-sm text-gray-900">{windowPreview.body}</div>
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <div>
                <button
                  type="button"
                  onClick={generateArchive}
                  disabled={isRunning || !!validationError}
                  className="w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50">
                  {isRunning ? "Generating..." : "Generate Archive"}
                </button>
                {validationError && !isRunning && <p className="mt-2 text-xs text-red-600">{validationError}</p>}
              </div>
            </div>
          </section>

          {/* Status Panel */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Run Status</h2>
                  {displayedJobId && (
                    <div className="mt-1">
                      <span className="text-xs text-gray-600">{displayedJobId}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* Status */}
              <div>
                <div className="mb-2 text-sm font-medium text-gray-900">Status</div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span>{statusText}</span>
                    {runState === "success" && displayedJob?.downloadUrl && (
                      <a
                        href={displayedJob.downloadUrl}
                        download
                        className="text-blue-600 hover:text-blue-700 underline text-sm">
                        Download
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Debug Logs */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">Live debug logs</div>
                </div>
                <div
                  ref={logViewportRef}
                  className="h-72 overflow-auto rounded-lg border border-gray-200 bg-black px-4 py-3 font-mono text-xs text-gray-100">
                  {logs.length === 0 ? (
                    <div className="text-gray-400">No logs yet. Click "Generate Archive" to start.</div>
                  ) : (
                    logs.map((l: (typeof logs)[0], idx: number) => (
                      <div key={`${l.ts}-${idx}`} className="whitespace-pre-wrap break-words">
                        <span className="text-gray-400">{formatLogTs(l.ts)}</span>{" "}
                        <span className={levelClass(l.level)}>[{l.level}]</span> {l.msg}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* All Jobs */}
              <div>
                <div className="mb-2 text-sm font-medium text-gray-900">All Jobs</div>
                {allJobs.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                    No jobs yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {allJobs.map((job: PastJob) => {
                      const isOpen = displayedJobId === job.id;
                      return (
                        <div
                          key={job.id}
                          className="rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900">{job.id}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isOpen ? (
                                <button
                                  type="button"
                                  disabled
                                  className="rounded-lg bg-gray-400 px-3 py-1.5 text-xs font-semibold text-white cursor-not-allowed opacity-60 whitespace-nowrap">
                                  Open
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openJob(job)}
                                  className="rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors whitespace-nowrap">
                                  Open
                                </button>
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
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-gray-200 pt-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs text-gray-600">
              © {new Date().getFullYear()} The Daily Princetonian. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
