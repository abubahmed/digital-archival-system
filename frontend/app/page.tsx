"use client";

import { useEffect, useMemo, useState } from "react";
import ConfigurationPanel from "./components/ConfigurationPanel";
import StatusPanel, { type LogLine } from "./components/StatusPanel";
import {
  computeWindowSingleDay,
  computeWindowRange,
  formatWindowPreview,
  formatEst,
  dateToEstDatetimeInput,
  parseEstDatetimeInput,
} from "./utils/dateHelpers";
import { type LogLevel } from "./utils/logHelpers";
import { validateBeforeRun } from "./utils/validation";

type Source = "instagram" | "twitter" | "tiktok" | "newsletter" | "dailyPrince" | "dailyPrinceIssues";
type ArchivalType = "singleDay" | "dateRange" | "urls" | "mostRecent";
type Delivery = "download" | "email";
type Schedule = "now" | "later";
type RunState = "idle" | "running" | "success" | "error";

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
    const d = new Date(Date.now());
    // Set to current time in EST
    return dateToEstDatetimeInput(d);
  });

  // Schedule
  const [scheduledFor, setScheduledFor] = useState<string>(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return dateToEstDatetimeInput(d);
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

  // Past jobs
  const [pastJobs, setPastJobs] = useState<PastJob[]>([
    {
      id: "job-1",
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      config: {
        source: "dailyPrince",
        archivalType: "singleDay",
        delivery: "download",
      },
      downloadUrl: "/api/run-archive-zip?start=2025-01-20&end=2025-01-20",
      state: "success",
      statusText: "Done (simulated).",
      progress: 100,
      logs: [
        { ts: Date.now() - 2 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: Date.now() - 2 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: dailyPrince, Type: singleDay, Delivery: download",
        },
        { ts: Date.now() - 2 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: Date.now() - 2 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Fetching items..." },
        { ts: Date.now() - 2 * 24 * 60 * 60 * 1000 + 800, level: "info", msg: "Processing items..." },
        { ts: Date.now() - 2 * 24 * 60 * 60 * 1000 + 1100, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully for 2025-01-20",
    },
    {
      id: "job-2",
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
      config: {
        source: "newsletter",
        archivalType: "dateRange",
        delivery: "download",
      },
      downloadUrl: "/api/run-archive-zip?start=2025-01-15&end=2025-01-17",
      state: "success",
      statusText: "Done (simulated).",
      progress: 100,
      logs: [
        { ts: Date.now() - 5 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: Date.now() - 5 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: newsletter, Type: dateRange, Delivery: download",
        },
        { ts: Date.now() - 5 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: Date.now() - 5 * 24 * 60 * 60 * 1000 + 500, level: "debug", msg: "Validating inputs..." },
        { ts: Date.now() - 5 * 24 * 60 * 60 * 1000 + 750, level: "info", msg: "Fetching newsletters..." },
        { ts: Date.now() - 5 * 24 * 60 * 60 * 1000 + 1050, level: "info", msg: "Processing items..." },
        { ts: Date.now() - 5 * 24 * 60 * 60 * 1000 + 1350, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully for date range 2025-01-15 to 2025-01-17",
    },
    {
      id: "job-3",
      createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
      config: {
        source: "dailyPrinceIssues",
        archivalType: "singleDay",
        delivery: "download",
      },
      downloadUrl: "/api/run-archive-zip?start=2025-01-13&end=2025-01-13",
      state: "success",
      statusText: "Done (simulated).",
      progress: 100,
      logs: [
        { ts: Date.now() - 7 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: Date.now() - 7 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: dailyPrinceIssues, Type: singleDay, Delivery: download",
        },
        { ts: Date.now() - 7 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: Date.now() - 7 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully for 2025-01-13",
    },
    {
      id: "job-4",
      createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
      config: {
        source: "instagram",
        archivalType: "mostRecent",
        delivery: "download",
      },
      downloadUrl: "/api/run-archive-zip?start=2025-01-10&end=2025-01-10",
      state: "success",
      statusText: "Done (simulated).",
      progress: 100,
      logs: [
        { ts: Date.now() - 10 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: Date.now() - 10 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: instagram, Type: mostRecent, Delivery: download",
        },
        { ts: Date.now() - 10 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: Date.now() - 10 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully",
    },
    {
      id: "job-5",
      createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14 days ago
      config: {
        source: "twitter",
        archivalType: "urls",
        delivery: "email",
      },
      state: "success",
      statusText: "Email sent.",
      progress: 100,
      logs: [
        { ts: Date.now() - 14 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: Date.now() - 14 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: twitter, Type: urls, Delivery: email",
        },
        { ts: Date.now() - 14 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: Date.now() - 14 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Archive process complete." },
        { ts: Date.now() - 14 * 24 * 60 * 60 * 1000 + 600, level: "info", msg: "Email sent to user@example.com" },
      ],
      details: "Archive sent via email to user@example.com",
    },
  ]);

  function openPastJob(job: PastJob) {
    setRunState(job.state);
    setStatusText(job.statusText);
    setDetails(job.details);
    setProgress(job.progress);
    setLogs(job.logs);
  }

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
      const since = mostRecentSince ? parseEstDatetimeInput(mostRecentSince) : null;
      if (!since || Number.isNaN(since.getTime())) return null;
      return {
        headline: "Selection window (EST)",
        body: `Most recent ${mostRecentCount} items since ${formatEst(since)} EST.`,
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
        const scheduledDate = parseEstDatetimeInput(scheduledFor);
        pushLog("info", `Scheduled for ${formatEst(scheduledDate)} EST (simulation).`);
        await sleep(800);
        setProgress(100);
        setRunState("success");
        setStatusText("Scheduled.");

        // Add to past jobs
        const jobId = `job-${Date.now()}`;
        setPastJobs((prev) => [
          {
            id: jobId,
            createdAt: Date.now(),
            config: { source, archivalType, delivery },
            downloadUrl: undefined,
            state: "success",
            statusText: "Scheduled.",
            progress: 100,
            logs: [...logs],
            details: "",
          },
          ...prev,
        ]);
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

      // Add to past jobs - capture current state values
      const jobId = `job-${Date.now()}`;
      let downloadUrl: string | undefined;
      if (delivery === "download") {
        if (archivalType === "singleDay") {
          downloadUrl = `/api/run-archive-zip?start=${date}&end=${date}`;
        } else if (archivalType === "dateRange") {
          downloadUrl = `/api/run-archive-zip?start=${start}&end=${end}`;
        } else {
          // Dummy link for other types
          downloadUrl = `/api/run-archive-zip?start=${todayStr}&end=${todayStr}`;
        }
      }
      // Use functional update to capture current state
      setPastJobs((prev) => [
        {
          id: jobId,
          createdAt: Date.now(),
          config: { source, archivalType, delivery },
          downloadUrl,
          state: "success",
          statusText: "Done (simulated).",
          progress: 100,
          logs: [...logs],
          details: details || "",
        },
        ...prev,
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunState("error");
      setStatusText("Failed.");
      setDetails(msg);
      pushLog("error", msg);

      // Add to past jobs even on error
      const jobId = `job-${Date.now()}`;
      setPastJobs((prev) => [
        {
          id: jobId,
          createdAt: Date.now(),
          config: { source, archivalType, delivery },
          downloadUrl: undefined,
          state: "error",
          statusText: "Failed.",
          progress: progress,
          logs: [...logs, { ts: Date.now(), level: "error", msg }],
          details: msg,
        },
        ...prev,
      ]);
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
                Configure and generate archives from various sources. All times are in EST (Eastern Standard Time).
              </p>
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

          <StatusPanel
            runState={runState}
            statusText={statusText}
            progress={progress}
            logs={logs}
            details={details}
            pastJobs={pastJobs}
            onOpenJob={openPastJob}
          />
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
