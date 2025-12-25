"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RadioCard from "../components/RadioCard";
import { getTodayStr, getInitialMostRecentSince, getWindowPreview } from "../utils/dateHelpers";
import { formatLogTs, levelClass } from "../utils/logHelpers";
import { validateBeforeRun } from "../utils/validation";
import { apiClient } from "../utils/httpClient";
import { normalizeUrls } from "../utils/urlHelpers";
import type { Source, ArchivalType, RunState, Job, Jobs, ArchivalConfig } from "../types";
import type { SingleDayParams, DateRangeParams, UrlsParams, MostRecentParams } from "../types";
import type { getJobsResponse, getJobResponse, createJobResponse } from "../types";

const REMEMBER_AUTH_TOKEN_KEY = "rememberAuthToken";
const AUTH_TOKEN_KEY = "authToken";

export default function Page() {
  // Core configuration
  const [source, setSource] = useState<Source>("dailyPrince");
  const [archivalType, setArchivalType] = useState<ArchivalType>("singleDay");

  // Params
  const todayStr = getTodayStr();
  const [singleDayParams, setSingleDayParams] = useState<SingleDayParams>({
    date: todayStr,
    dateStartTime: "00:00",
    dateEndTime: "00:00",
  });
  const [dateRangeParams, setDateRangeParams] = useState<DateRangeParams>({
    start: todayStr,
    end: todayStr,
    startTime: "00:00",
    endTime: "00:00",
  });
  const [urlsText, setUrlsText] = useState<string>("");
  const normalizedUrls = useMemo(() => normalizeUrls(urlsText), [urlsText]);
  const urlsParams = useMemo(() => ({ urls: normalizedUrls }), [normalizedUrls]) as UrlsParams;
  const [mostRecentParams, setMostRecentParams] = useState<MostRecentParams>({
    mostRecentCount: 50,
    mostRecentSince: getInitialMostRecentSince(),
  });

  const [authToken, setAuthToken] = useState<string>("");
  const [saveAuthToken, setSaveAuthToken] = useState<boolean>(false);

  const [jobs, setJobs] = useState<Jobs>({});
  const [displayedJob, setDisplayedJob] = useState<Job | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saveAuthToken = localStorage.getItem(REMEMBER_AUTH_TOKEN_KEY);
    if (saveAuthToken === "true") {
      setSaveAuthToken(true);
      setAuthToken(localStorage.getItem(AUTH_TOKEN_KEY) ?? "");
    } else {
      setSaveAuthToken(false);
      setAuthToken("");
    }
  }, []);

  useEffect(() => {
    if (saveAuthToken) {
      localStorage.setItem(REMEMBER_AUTH_TOKEN_KEY, "true");
      localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    } else {
      localStorage.setItem(REMEMBER_AUTH_TOKEN_KEY, "false");
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }, [saveAuthToken, authToken]);

  // Fetches the list of all jobs from the API and sets the jobs state.
  const fetchAllJobs = async () => {
    try {
      const JOBS_ENDPOINT = "/jobs";
      const response = await apiClient.get<getJobsResponse>(JOBS_ENDPOINT, authToken);
      const jobs = response.jobs;
      console.log("Fetched jobs:", jobs);
      setJobs(jobs);
      return jobs;
    } catch (error) {
      console.error("Error fetching jobs:", error);
      setJobs({});
    }
  };

  useEffect(() => {
    fetchAllJobs();
  }, []);

  // Server-Sent Events for job updates
  useEffect(() => {
    const jobId = displayedJob?.jobId;
    const jobState = displayedJob?.state;

    if (!jobId) {
      if (eventSourceRef.current) {
        console.log("Closing event source for no job");
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    if (jobState !== "running") {
      if (eventSourceRef.current) {
        console.log("Closing event source for non-running job");
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    if (eventSourceRef.current) {
      console.log("Closing existing event source");
      eventSourceRef.current.close();
    }

    console.log("Creating new event source for job", jobId);
    const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.job) {
          const updatedJob: Job = data.job;
          setJobs((prev) => ({ ...prev, [updatedJob.jobId]: updatedJob }));
          if (updatedJob.jobId === displayedJob?.jobId) {
            setDisplayedJob(updatedJob);
          }
        } else if (data.error) {
          console.error("SSE error:", data.error);
          eventSource.close();
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      eventSource.close();
      eventSourceRef.current = null;
    };

    return () => {
      console.log("Closing event source");
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [displayedJob?.jobId]);

  // Scroll to bottom of log viewport
  useEffect(() => {
    const element = logViewportRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [displayedJob?.logs.length]);

  // Displayed job
  const logs = displayedJob?.logs ?? [];
  const statusTexts: Record<RunState, string> = {
    idle: "Ready.",
    running: "Running...",
    success: "Done.",
    error: "Failed.",
  };
  const statusText = statusTexts[displayedJob?.state ?? "idle"];

  const archivalConfig = useMemo(() => {
    const typeParams =
      archivalType === "singleDay"
        ? singleDayParams
        : archivalType === "dateRange"
        ? dateRangeParams
        : archivalType === "urls"
        ? urlsParams
        : mostRecentParams;

    return { source, archivalType, authToken, typeParams } as ArchivalConfig;
  }, [source, archivalType, authToken, singleDayParams, dateRangeParams, urlsParams, mostRecentParams]);

  // Window selection preview
  const windowPreview = useMemo(() => {
    return getWindowPreview(archivalConfig);
  }, [archivalConfig]);

  // Validate before run
  const validationError = useMemo(() => {
    return validateBeforeRun(archivalConfig);
  }, [archivalConfig]);

  async function generateArchive() {
    if (validationError) {
      return;
    }
    try {
      const response = await apiClient.post<createJobResponse>("/jobs", {
        ...archivalConfig,
      });
      const job = response.job;
      setDisplayedJob(job);

      await fetchAllJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to create archive job:", msg);
      alert(`Failed to create archive job: ${msg}`);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white via-gray-50 to-gray-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
                    checked={saveAuthToken}
                    onChange={(e) => setSaveAuthToken(e.target.checked)}
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
                        value={singleDayParams.date}
                        onChange={(e) => setSingleDayParams((prev) => ({ ...prev, date: e.target.value }))}
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
                          value={singleDayParams.dateStartTime}
                          onChange={(e) => setSingleDayParams((prev) => ({ ...prev, dateStartTime: e.target.value }))}
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
                          value={singleDayParams.dateEndTime}
                          onChange={(e) => setSingleDayParams((prev) => ({ ...prev, dateEndTime: e.target.value }))}
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
                          value={dateRangeParams.start}
                          onChange={(e) => setDateRangeParams((prev) => ({ ...prev, start: e.target.value }))}
                          max={dateRangeParams.end || todayStr}
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
                          value={dateRangeParams.end}
                          onChange={(e) => setDateRangeParams((prev) => ({ ...prev, end: e.target.value }))}
                          min={dateRangeParams.start}
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
                          value={dateRangeParams.startTime}
                          onChange={(e) => setDateRangeParams((prev) => ({ ...prev, startTime: e.target.value }))}
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
                          value={dateRangeParams.endTime}
                          onChange={(e) => setDateRangeParams((prev) => ({ ...prev, endTime: e.target.value }))}
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
                        value={mostRecentParams.mostRecentCount}
                        onChange={(e) =>
                          setMostRecentParams((prev) => ({
                            ...prev,
                            mostRecentCount: Number(e.target.value),
                          }))
                        }
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
                        value={mostRecentParams.mostRecentSince}
                        onChange={(e) =>
                          setMostRecentParams((prev) => ({
                            ...prev,
                            mostRecentSince: e.target.value,
                          }))
                        }
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
                  disabled={!!validationError}
                  className="w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50">
                  Generate Archive
                </button>
                {validationError && <p className="mt-2 text-xs text-red-600">{validationError}</p>}
              </div>
            </div>
          </section>

          {/* Status Panel */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Run Status</h2>
                  {displayedJob?.jobId && (
                    <div className="mt-1">
                      <span className="text-xs text-gray-600">{displayedJob.jobId}</span>
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
                    {displayedJob?.state === "success" && displayedJob?.downloadUrl && (
                      <a
                        href={displayedJob.downloadUrl}
                        download
                        target="_blank"
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
                      <div key={`${l.timestamp}-${idx}`} className="whitespace-pre-wrap break-words">
                        <span className="text-gray-400">{formatLogTs(l.timestamp)}</span>{" "}
                        <span className={levelClass(l.level)}>[{l.level}]</span> {l.message}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-gray-900">All Jobs</div>
                {Object.keys(jobs).length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                    No jobs found.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {Object.values(jobs).map((job: Job) => {
                      const isOpen = displayedJob?.jobId === job.jobId;
                      return (
                        <div
                          key={job.jobId}
                          className="rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900">{job.jobId}</div>
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
                                  onClick={() => {
                                    setDisplayedJob(job);
                                  }}
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
      </div>
    </div>
  );
}
