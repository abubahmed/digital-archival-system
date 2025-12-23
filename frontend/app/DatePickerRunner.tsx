"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export default function DatePickerRunner() {
  const CUTOFF_HOUR_LOCAL = 15;

  type Source = "instagram" | "twitter" | "tiktok" | "newsletter" | "dailyPrince" | "dailyPrinceIssues";
  type ArchivalType = "singleDay" | "dateRange" | "urls" | "mostRecent";
  type Delivery = "download" | "email";
  type Schedule = "now" | "later";
  type RunState = "idle" | "running" | "success" | "error";

  type LogLevel = "debug" | "info" | "warn" | "error";
  type LogLine = { ts: number; level: LogLevel; msg: string };

  const todayStr = useMemo(() => dateToYmd(new Date()), []);

  // Core configuration
  const [source, setSource] = useState<Source>("dailyPrince");
  const [archivalType, setArchivalType] = useState<ArchivalType>("singleDay");
  const [delivery, setDelivery] = useState<Delivery>("download");
  const [schedule, setSchedule] = useState<Schedule>("now");

  // Single day / range dates
  const [date, setDate] = useState<string>(todayStr);
  const [start, setStart] = useState<string>(todayStr);
  const [end, setEnd] = useState<string>(todayStr);

  // URL mode
  const [urlsText, setUrlsText] = useState("");

  // Most recent mode
  const [mostRecentCount, setMostRecentCount] = useState<number>(50);
  const [mostRecentSince, setMostRecentSince] = useState<string>(() => {
    const d = new Date();
    d.setHours(Math.min(CUTOFF_HOUR_LOCAL, 23), 0, 0, 0);
    return dateToLocalDatetimeInput(d);
  });

  // Schedule details
  const [scheduledFor, setScheduledFor] = useState<string>(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return dateToLocalDatetimeInput(d);
  });

  // Auth (UI only)
  const [authToken, setAuthToken] = useState<string>("");
  const [rememberAuth, setRememberAuth] = useState<boolean>(true);

  // Run output
  const [runState, setRunState] = useState<RunState>("idle");
  const [statusText, setStatusText] = useState<string>("Ready.");
  const [details, setDetails] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [debug, setDebug] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [email, setEmail] = useState<string>("");

  const logViewportRef = useRef<HTMLDivElement | null>(null);

  const isRunning = runState === "running";

  const normalizedUrls = useMemo(() => {
    return urlsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [urlsText]);

  const windowPreview = useMemo(() => {
    if (archivalType === "singleDay") {
      const w = computeWindowSingleDay(date, CUTOFF_HOUR_LOCAL);
      return w ? formatWindowPreview(w.start, w.end, CUTOFF_HOUR_LOCAL) : null;
    }
    if (archivalType === "dateRange") {
      const w = computeWindowRange(start, end, CUTOFF_HOUR_LOCAL);
      return w ? formatWindowPreview(w.start, w.end, CUTOFF_HOUR_LOCAL) : null;
    }
    if (archivalType === "mostRecent") {
      const since = mostRecentSince ? new Date(mostRecentSince) : null;
      if (!since || Number.isNaN(since.getTime())) return null;
      return {
        headline: "Selection window (local time)",
        body: `Most recent ${mostRecentCount} items since ${formatLocal(since)} (cutoff guidance: ${String(
          CUTOFF_HOUR_LOCAL
        ).padStart(2, "0")}:00).`,
      };
    }
    return {
      headline: "Selection window",
      body: `Using explicit URL list (${normalizedUrls.length} URL${normalizedUrls.length === 1 ? "" : "s"}).`,
    };
  }, [archivalType, date, start, end, mostRecentSince, mostRecentCount, normalizedUrls.length]);

  // UI-only: no API wiring (by request).

  // Persist auth token locally (optional; UI only)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("archive_ui_auth_token");
      if (saved) setAuthToken(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (!rememberAuth) return;
      if (!authToken) {
        window.localStorage.removeItem("archive_ui_auth_token");
        return;
      }
      window.localStorage.setItem("archive_ui_auth_token", authToken);
    } catch {
      // ignore
    }
  }, [authToken, rememberAuth]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    const el = logViewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  function pushLog(level: LogLevel, msg: string) {
    setLogs((prev) => [...prev, { ts: Date.now(), level, msg }]);
  }

  function resetRunOutput() {
    setRunState("idle");
    setStatusText("Ready.");
    setDetails("");
    setProgress(0);
    setLogs([]);
  }

  function buildRequestSummary() {
    return {
      source,
      archivalType,
      schedule: schedule === "now" ? { mode: "now" } : { mode: "later", scheduledFor },
      delivery: delivery === "download" ? { mode: "download" } : { mode: "email", email },
      auth: authToken ? { mode: "token", tokenPreview: redactToken(authToken) } : { mode: "none" },
      selection:
        archivalType === "singleDay"
          ? { date, window: computeWindowSingleDay(date, CUTOFF_HOUR_LOCAL) }
          : archivalType === "dateRange"
            ? { start, end, window: computeWindowRange(start, end, CUTOFF_HOUR_LOCAL) }
            : archivalType === "urls"
              ? { urls: normalizedUrls }
              : { count: mostRecentCount, since: mostRecentSince },
      debug,
    };
  }

  async function simulateRun() {
    // UI-only “fake” run: progress + logs.
    pushLog("info", "Starting simulated run (no API wiring).");
    pushLog("debug", "Building request payload…");
    await sleep(300);
    pushLog("debug", "Validating selection…");
    await sleep(250);
    pushLog("info", "Fetching items…");
    await sleep(300);
    pushLog("info", "Transforming + packaging…");
    await sleep(300);

    pushLog("info", delivery === "email" ? `Would email results to ${email || "(missing email)"}` : "Would prepare a browser download");
    await sleep(250);

    pushLog("info", "Simulated run complete.");
  }

  function validateBeforeRun(): string | null {
    if (delivery === "email" && !email.trim()) return "Email delivery selected, but email address is empty.";
    if (archivalType === "singleDay" && !isValidYmd(date)) return "Single-day selected, but date is invalid.";
    if (archivalType === "dateRange" && (!isValidYmd(start) || !isValidYmd(end))) return "Date-range selected, but start/end are invalid.";
    if (archivalType === "dateRange" && start > end) return "Date-range selected, but start date is after end date.";
    if (archivalType === "urls" && normalizedUrls.length === 0) return "URL list selected, but no URLs were provided.";
    if (archivalType === "mostRecent" && (!mostRecentSince || Number.isNaN(new Date(mostRecentSince).getTime())))
      return "Most-recent selected, but the starting date/time is invalid.";
    if (archivalType === "mostRecent" && (!Number.isFinite(mostRecentCount) || mostRecentCount <= 0))
      return "Most-recent selected, but item count must be a positive number.";
    if (schedule === "later" && (!scheduledFor || Number.isNaN(new Date(scheduledFor).getTime()))) return "Schedule set to later, but scheduled time is invalid.";
    return null;
  }

  async function generateArchive() {
    const validationError = validateBeforeRun();
    if (validationError) {
      setRunState("error");
      setStatusText("Fix inputs before running.");
      setDetails(validationError);
      pushLog("error", validationError);
      return;
    }

    setRunState("running");
    setStatusText(schedule === "later" ? "Scheduled (simulation)..." : "Running...");
    setDetails("");
    setProgress(2);
    setLogs([]);

    const summary = buildRequestSummary();
    pushLog("info", "Archive job configured.");
    if (debug) pushLog("debug", `Config: ${JSON.stringify(summary, null, 2)}`);
    setDetails(JSON.stringify(summary, null, 2));

    // Progress ticker (UI only)
    const ticker = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 95) return p;
        const bump = 3 + Math.floor(Math.random() * 6);
        return Math.min(95, p + bump);
      });
    }, 350);

    try {
      if (schedule === "later") {
        pushLog("info", `Scheduled for ${formatLocal(new Date(scheduledFor))} (simulation).`);
        await sleep(800);
        setProgress(100);
        setRunState("success");
        setStatusText("Scheduled.");
        return;
      }

      await simulateRun();
      setProgress(100);
      setRunState("success");
      setStatusText("Done (simulated).");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunState("error");
      setStatusText("Failed.");
      setDetails(msg);
      pushLog("error", msg);
    } finally {
      window.clearInterval(ticker);
      setProgress((p) => (p < 100 && runState !== "error" ? 100 : p));
    }
  }

  const runButtonDisabled = isRunning || !!validateBeforeRun();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white via-white to-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Archive Builder</h1>
              <p className="mt-1 text-sm text-gray-600">
                UI-only builder for configuring an archive run (no API wiring yet). Cutoff logic previews use{" "}
                <span className="font-mono">{String(CUTOFF_HOUR_LOCAL).padStart(2, "0")}:00</span> local time.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetRunOutput}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                disabled={isRunning}
              >
                Reset output
              </button>
              <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
                Debug
              </label>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Config */}
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold">Configuration</h2>
              <p className="mt-1 text-sm text-gray-600">Pick a source and an archival type, then refine details below.</p>
            </div>

            <div className="grid gap-5 px-5 py-5">
              <div className="grid gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium" htmlFor="source">
                      Source of archival data
                    </label>
                    <select
                      id="source"
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      value={source}
                      onChange={(e) => setSource(e.target.value as Source)}
                    >
                      <option value="instagram">Instagram</option>
                      <option value="twitter">Twitter / X</option>
                      <option value="tiktok">TikTok</option>
                      <option value="newsletter">Newsletter</option>
                      <option value="dailyPrince">Daily Prince website</option>
                      <option value="dailyPrinceIssues">Daily Prince website + newsletter (issues)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium" htmlFor="delivery">
                      Data return type
                    </label>
                    <select
                      id="delivery"
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      value={delivery}
                      onChange={(e) => setDelivery(e.target.value as Delivery)}
                    >
                      <option value="download">Browser download</option>
                      <option value="email">Email when complete</option>
                    </select>
                    {delivery === "email" && (
                      <div className="mt-2">
                        <label className="text-xs font-medium text-gray-700" htmlFor="email">
                          Email address
                        </label>
                        <input
                          id="email"
                          type="email"
                          inputMode="email"
                          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                          placeholder="you@domain.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Type of archival</div>
                    <div className="text-xs text-gray-600">Choose the selection mode for what to archive.</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <RadioCard
                    name="archivalType"
                    value="singleDay"
                    checked={archivalType === "singleDay"}
                    onChange={() => setArchivalType("singleDay")}
                    title="Single day"
                    subtitle="Previous day 15:00 → selected day 15:00"
                  />
                  <RadioCard
                    name="archivalType"
                    value="dateRange"
                    checked={archivalType === "dateRange"}
                    onChange={() => setArchivalType("dateRange")}
                    title="Date range"
                    subtitle="Start-1 day 15:00 → End day 15:00"
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

              <div className="grid gap-3">
                <div className="text-sm font-medium">Selection details</div>

                {archivalType === "singleDay" && (
                  <div className="grid gap-2">
                    <label className="text-xs font-medium text-gray-700" htmlFor="date">
                      Date
                    </label>
                    <input
                      id="date"
                      type="date"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      max={todayStr}
                      required
                    />
                  </div>
                )}

                {archivalType === "dateRange" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-gray-700" htmlFor="start">
                        Start date
                      </label>
                      <input
                        id="start"
                        type="date"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        max={end || todayStr}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700" htmlFor="end">
                        End date
                      </label>
                      <input
                        id="end"
                        type="date"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        min={start}
                        max={todayStr}
                        required
                      />
                    </div>
                  </div>
                )}

                {archivalType === "urls" && (
                  <div className="grid gap-2">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700" htmlFor="urls">
                          URLs (one per line)
                        </label>
                        <div className="text-xs text-gray-600">Tip: you can paste from a spreadsheet column.</div>
                      </div>
                      <div className="text-xs text-gray-600">{normalizedUrls.length} parsed</div>
                    </div>
                    <textarea
                      id="urls"
                      className="min-h-32 w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder={`https://example.com/post/123\nhttps://example.com/post/456`}
                      value={urlsText}
                      onChange={(e) => setUrlsText(e.target.value)}
                    />
                  </div>
                )}

                {archivalType === "mostRecent" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-gray-700" htmlFor="count">
                        Most recent X items
                      </label>
                      <input
                        id="count"
                        type="number"
                        min={1}
                        step={1}
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                        value={String(mostRecentCount)}
                        onChange={(e) => setMostRecentCount(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700" htmlFor="since">
                        Since (local datetime)
                      </label>
                      <input
                        id="since"
                        type="datetime-local"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                        value={mostRecentSince}
                        onChange={(e) => setMostRecentSince(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {windowPreview && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-medium text-gray-700">{windowPreview.headline}</div>
                    <div className="mt-1 text-sm text-gray-900">{windowPreview.body}</div>
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <div className="text-sm font-medium">Schedule</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <RadioCard
                    name="schedule"
                    value="now"
                    checked={schedule === "now"}
                    onChange={() => setSchedule("now")}
                    title="Run now"
                    subtitle="Start immediately"
                  />
                  <RadioCard
                    name="schedule"
                    value="later"
                    checked={schedule === "later"}
                    onChange={() => setSchedule("later")}
                    title="Schedule"
                    subtitle="Queue for later"
                  />
                </div>
                {schedule === "later" && (
                  <div className="grid gap-2">
                    <label className="text-xs font-medium text-gray-700" htmlFor="scheduledFor">
                      Scheduled for (local datetime)
                    </label>
                    <input
                      id="scheduledFor"
                      type="datetime-local"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Auth</div>
                    <div className="text-xs text-gray-600">UI placeholder (token not used unless your API expects it).</div>
                  </div>
                  <div className="text-xs text-gray-600">{authToken ? "Token set" : "No token"}</div>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs font-medium text-gray-700" htmlFor="token">
                    API key / token
                  </label>
                  <input
                    id="token"
                    type="password"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Paste token here"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    autoComplete="off"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" checked={rememberAuth} onChange={(e) => setRememberAuth(e.target.checked)} />
                    Remember token in this browser (localStorage)
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Right: Run + Logs */}
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold">Run</h2>
              <p className="mt-1 text-sm text-gray-600">Generate the archive, monitor status, and inspect debug output.</p>
            </div>

            <div className="grid gap-4 px-5 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={generateArchive}
                  disabled={runButtonDisabled}
                  className="inline-flex items-center justify-center rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRunning ? "Generating…" : "Generate archive"}
                </button>

                <div className="text-xs text-gray-600">
                  {runButtonDisabled && !isRunning ? (
                    <span>
                      Fix inputs to run.{" "}
                      <span className="font-mono text-gray-500">{validateBeforeRun() || ""}</span>
                    </span>
                  ) : (
                    <span className="font-mono text-gray-500">Cutoff: {String(CUTOFF_HOUR_LOCAL).padStart(2, "0")}:00</span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium text-gray-800">Status</div>
                  <div className="text-xs text-gray-600">
                    {runState === "running" ? "Running" : runState === "success" ? "Success" : runState === "error" ? "Error" : "Idle"}
                  </div>
                </div>

                <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900">{statusText}</div>

                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full transition-all ${
                        runState === "error" ? "bg-red-600" : runState === "success" ? "bg-emerald-600" : "bg-black"
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right text-xs text-gray-600">{Math.round(progress)}%</div>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Live debug logs</div>
                  <div className="text-xs text-gray-600">{logs.length} line{logs.length === 1 ? "" : "s"}</div>
                </div>
                <div
                  ref={logViewportRef}
                  className="h-72 overflow-auto rounded-xl border border-gray-200 bg-black p-3 font-mono text-xs text-gray-100"
                >
                  {logs.length === 0 ? (
                    <div className="text-gray-400">No logs yet. Click “Generate archive”.</div>
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

              <div className="grid gap-2">
                <div className="text-sm font-medium">Status / details</div>
                <pre className="max-h-72 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-900">
                  {details || "(none)"}
                </pre>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-8 text-xs text-gray-500">
          Note: This is intentionally UI-only. The “Generate archive” action simulates a run and outputs logs + a JSON config payload you can send to
          your backend later.
        </footer>
      </div>
    </div>
  );
}

function RadioCard(props: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
        props.checked ? "border-black bg-gray-50" : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <input type="radio" name={props.name} value={props.value} checked={props.checked} onChange={props.onChange} className="mt-1" />
      <span className="grid gap-0.5">
        <span className="text-sm font-medium text-gray-900">{props.title}</span>
        <span className="text-xs text-gray-600">{props.subtitle}</span>
      </span>
    </label>
  );
}

function isValidYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function dateToYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateToLocalDatetimeInput(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function computeWindowSingleDay(dateStr: string, cutoffHourLocal: number) {
  if (!isValidYmd(dateStr)) return null;
  const end = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  end.setHours(cutoffHourLocal, 0, 0, 0);
  const start = new Date(end.getTime());
  start.setDate(start.getDate() - 1);
  return { start, end };
}

function computeWindowRange(startStr: string, endStr: string, cutoffHourLocal: number) {
  if (!isValidYmd(startStr) || !isValidYmd(endStr)) return null;
  const end = new Date(`${endStr}T00:00:00`);
  const startBase = new Date(`${startStr}T00:00:00`);
  if (Number.isNaN(end.getTime()) || Number.isNaN(startBase.getTime())) return null;
  end.setHours(cutoffHourLocal, 0, 0, 0);
  startBase.setHours(cutoffHourLocal, 0, 0, 0);
  startBase.setDate(startBase.getDate() - 1);
  return { start: startBase, end };
}

function formatLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function formatWindowPreview(start: Date, end: Date, cutoffHourLocal: number) {
  return {
    headline: "Computed window (local time)",
    body: `${formatLocal(start)} → ${formatLocal(end)} (cutoff ${String(cutoffHourLocal).padStart(2, "0")}:00).`,
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function redactToken(token: string) {
  const t = token.trim();
  if (t.length <= 8) return "********";
  return `${t.slice(0, 3)}…${t.slice(-3)}`;
}

function formatLogTs(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function levelClass(level: "debug" | "info" | "warn" | "error") {
  if (level === "error") return "text-red-400";
  if (level === "warn") return "text-amber-300";
  if (level === "debug") return "text-sky-300";
  return "text-emerald-300";
}
