"use client";

import { useEffect, useMemo, useState } from "react";
import ConfigurationPanel from "./components/ConfigurationPanel";
import StatusPanel, { type LogLine } from "./components/StatusPanel";
import {
  computeWindowSingleDay,
  computeWindowRange,
  formatWindowPreview,
  formatLocal,
  dateToLocalDatetimeInput,
} from "./utils/dateHelpers";
import { type LogLevel } from "./utils/logHelpers";
import { validateBeforeRun } from "./utils/validation";

type Source = "instagram" | "twitter" | "tiktok" | "newsletter" | "dailyPrince" | "dailyPrinceIssues";
type ArchivalType = "singleDay" | "dateRange" | "urls" | "mostRecent";
type Delivery = "download" | "email";
type Schedule = "now" | "later";
type RunState = "idle" | "running" | "success" | "error";

const CUTOFF_HOUR_LOCAL = 15;

export default function Page() {
  // Core configuration
  const [source, setSource] = useState<Source>("dailyPrince");
  const [archivalType, setArchivalType] = useState<ArchivalType>("singleDay");
  const [delivery, setDelivery] = useState<Delivery>("download");
  const [schedule, setSchedule] = useState<Schedule>("now");

  // Dates
  const todayStr = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

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
  const [mostRecentSince, setMostRecentSince] = useState<string>(() => {
    const d = new Date();
    d.setHours(Math.min(CUTOFF_HOUR_LOCAL, 23), 0, 0, 0);
    return dateToLocalDatetimeInput(d);
  });

  // Schedule
  const [scheduledFor, setScheduledFor] = useState<string>(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return dateToLocalDatetimeInput(d);
  });

  // Auth
  const [authToken, setAuthToken] = useState<string>("");
  const [rememberAuth, setRememberAuth] = useState<boolean>(true);

  // Email
  const [email, setEmail] = useState<string>("");

  // Run state
  const [runState, setRunState] = useState<RunState>("idle");
  const [statusText, setStatusText] = useState<string>("Ready.");
  const [details, setDetails] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [debug, setDebug] = useState<boolean>(false);

  const isRunning = runState === "running";

  // Normalize URLs
  const normalizedUrls = useMemo(() => {
    return urlsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [urlsText]);

  // Window preview
  const windowPreview = useMemo(() => {
    if (archivalType === "singleDay") {
      const w = computeWindowSingleDay(date, dateStartTime, dateEndTime);
      return w ? formatWindowPreview(w.start, w.end) : null;
    }
    if (archivalType === "dateRange") {
      const w = computeWindowRange(start, end, startTime, endTime);
      return w ? formatWindowPreview(w.start, w.end) : null;
    }
    if (archivalType === "mostRecent") {
      const since = mostRecentSince ? new Date(mostRecentSince) : null;
      if (!since || Number.isNaN(since.getTime())) return null;
      return {
        headline: "Selection window (local time)",
        body: `Most recent ${mostRecentCount} items since ${formatLocal(since)}.`,
      };
    }
    return {
      headline: "Selection window",
      body: `Using explicit URL list (${normalizedUrls.length} URL${normalizedUrls.length === 1 ? "" : "s"}).`,
    };
  }, [
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
  ]);

  // Persist auth token
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

  const validationError = useMemo(
    () =>
      validateBeforeRun(
        delivery,
        archivalType,
        date,
        start,
        end,
        normalizedUrls,
        mostRecentSince,
        mostRecentCount,
        schedule,
        scheduledFor,
        email
      ),
    [
      delivery,
      archivalType,
      date,
      start,
      end,
      normalizedUrls,
      mostRecentSince,
      mostRecentCount,
      schedule,
      scheduledFor,
      email,
    ]
  );

  async function generateArchive() {
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

    pushLog("info", "Archive job configured.");
    pushLog("info", `Source: ${source}, Type: ${archivalType}, Delivery: ${delivery}`);

    // Progress ticker (simulated)
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

      // Simulate archive process
      pushLog("info", "Starting archive process...");
      await sleep(300);
      pushLog("debug", "Validating inputs...");
      await sleep(250);
      pushLog("info", "Fetching items...");
      await sleep(300);
      pushLog("info", "Processing items...");
      await sleep(300);
      pushLog(
        "info",
        delivery === "email"
          ? `Would email results to ${email || "(missing email)"}`
          : "Would prepare a browser download"
      );
      await sleep(250);
      pushLog("info", "Archive process complete.");

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

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white via-gray-50 to-gray-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Archive Builder</h1>
              <p className="mt-2 text-sm text-gray-600">
                Configure and generate archives from various sources. Times are in EST.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetRunOutput}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={isRunning}>
                Reset
              </button>
              <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={debug}
                  onChange={(e) => setDebug(e.target.checked)}
                  className="rounded"
                />
                Debug
              </label>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ConfigurationPanel
            source={source}
            setSource={setSource}
            archivalType={archivalType}
            setArchivalType={setArchivalType}
            delivery={delivery}
            setDelivery={setDelivery}
            schedule={schedule}
            setSchedule={setSchedule}
            date={date}
            setDate={setDate}
            dateStartTime={dateStartTime}
            setDateStartTime={setDateStartTime}
            dateEndTime={dateEndTime}
            setDateEndTime={setDateEndTime}
            start={start}
            setStart={setStart}
            startTime={startTime}
            setStartTime={setStartTime}
            end={end}
            setEnd={setEnd}
            endTime={endTime}
            setEndTime={setEndTime}
            urlsText={urlsText}
            setUrlsText={setUrlsText}
            normalizedUrls={normalizedUrls}
            mostRecentCount={mostRecentCount}
            setMostRecentCount={setMostRecentCount}
            mostRecentSince={mostRecentSince}
            setMostRecentSince={setMostRecentSince}
            scheduledFor={scheduledFor}
            setScheduledFor={setScheduledFor}
            email={email}
            setEmail={setEmail}
            authToken={authToken}
            setAuthToken={setAuthToken}
            rememberAuth={rememberAuth}
            setRememberAuth={setRememberAuth}
            todayStr={todayStr}
            windowPreview={windowPreview}
            onGenerate={generateArchive}
            isRunning={isRunning}
            validationError={validationError}
          />

          <StatusPanel runState={runState} statusText={statusText} progress={progress} logs={logs} details={details} />
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
