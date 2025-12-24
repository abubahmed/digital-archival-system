import type { PastJob } from "./types";

export function getInitialPastJobs(): PastJob[] {
  const now = Date.now();
  return [
    {
      id: "job-1",
      createdAt: now - 2 * 24 * 60 * 60 * 1000,
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
        { ts: now - 2 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: now - 2 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: dailyPrince, Type: singleDay, Delivery: download",
        },
        { ts: now - 2 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: now - 2 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Fetching items..." },
        { ts: now - 2 * 24 * 60 * 60 * 1000 + 800, level: "info", msg: "Processing items..." },
        { ts: now - 2 * 24 * 60 * 60 * 1000 + 1100, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully for 2025-01-20",
    },
    {
      id: "job-2",
      createdAt: now - 5 * 24 * 60 * 60 * 1000,
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
        { ts: now - 5 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: now - 5 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: newsletter, Type: dateRange, Delivery: download",
        },
        { ts: now - 5 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: now - 5 * 24 * 60 * 60 * 1000 + 500, level: "debug", msg: "Validating inputs..." },
        { ts: now - 5 * 24 * 60 * 60 * 1000 + 750, level: "info", msg: "Fetching newsletters..." },
        { ts: now - 5 * 24 * 60 * 60 * 1000 + 1050, level: "info", msg: "Processing items..." },
        { ts: now - 5 * 24 * 60 * 60 * 1000 + 1350, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully for date range 2025-01-15 to 2025-01-17",
    },
    {
      id: "job-3",
      createdAt: now - 7 * 24 * 60 * 60 * 1000,
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
        { ts: now - 7 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: now - 7 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: dailyPrinceIssues, Type: singleDay, Delivery: download",
        },
        { ts: now - 7 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: now - 7 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully for 2025-01-13",
    },
    {
      id: "job-4",
      createdAt: now - 10 * 24 * 60 * 60 * 1000,
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
        { ts: now - 10 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: now - 10 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: instagram, Type: mostRecent, Delivery: download",
        },
        { ts: now - 10 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: now - 10 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully",
    },
    {
      id: "job-5",
      createdAt: now - 14 * 24 * 60 * 60 * 1000,
      config: {
        source: "twitter",
        archivalType: "urls",
        delivery: "email",
      },
      state: "success",
      statusText: "Email sent.",
      progress: 100,
      logs: [
        { ts: now - 14 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: now - 14 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: twitter, Type: urls, Delivery: email",
        },
        { ts: now - 14 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: now - 14 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Archive process complete." },
        { ts: now - 14 * 24 * 60 * 60 * 1000 + 600, level: "info", msg: "Email sent to user@example.com" },
      ],
      details: "Archive sent via email to user@example.com",
    },
  ];
}
