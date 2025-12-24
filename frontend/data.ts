import type { PastJob } from "./types";
import { generateJobId } from "./utils/jobHelpers";

export function getInitialPastJobs(): PastJob[] {
  const now = Date.now();
  return [
    {
      id: generateJobId("dailyPrince", "singleDay", now - 2 * 24 * 60 * 60 * 1000),
      createdAt: now - 2 * 24 * 60 * 60 * 1000,
      config: {
        source: "dailyPrince",
        archivalType: "singleDay",
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
          msg: "Source: dailyPrince, Type: singleDay",
        },
        { ts: now - 2 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: now - 2 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Fetching items..." },
        { ts: now - 2 * 24 * 60 * 60 * 1000 + 800, level: "info", msg: "Processing items..." },
        { ts: now - 2 * 24 * 60 * 60 * 1000 + 1100, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully for 2025-01-20",
    },
    {
      id: generateJobId("newsletter", "dateRange", now - 5 * 24 * 60 * 60 * 1000),
      createdAt: now - 5 * 24 * 60 * 60 * 1000,
      config: {
        source: "newsletter",
        archivalType: "dateRange",
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
          msg: "Source: newsletter, Type: dateRange",
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
      id: generateJobId("dailyPrinceIssues", "singleDay", now - 7 * 24 * 60 * 60 * 1000),
      createdAt: now - 7 * 24 * 60 * 60 * 1000,
      config: {
        source: "dailyPrinceIssues",
        archivalType: "singleDay",
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
          msg: "Source: dailyPrinceIssues, Type: singleDay",
        },
        { ts: now - 7 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: now - 7 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully for 2025-01-13",
    },
    {
      id: generateJobId("instagram", "mostRecent", now - 10 * 24 * 60 * 60 * 1000),
      createdAt: now - 10 * 24 * 60 * 60 * 1000,
      config: {
        source: "instagram",
        archivalType: "mostRecent",
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
          msg: "Source: instagram, Type: mostRecent",
        },
        { ts: now - 10 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: now - 10 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully",
    },
    {
      id: generateJobId("twitter", "urls", now - 14 * 24 * 60 * 60 * 1000),
      createdAt: now - 14 * 24 * 60 * 60 * 1000,
      config: {
        source: "twitter",
        archivalType: "urls",
      },
      downloadUrl: "/api/run-archive-zip?start=2025-01-06&end=2025-01-06",
      state: "success",
      statusText: "Done (simulated).",
      progress: 100,
      logs: [
        { ts: now - 14 * 24 * 60 * 60 * 1000, level: "info", msg: "Archive job configured." },
        {
          ts: now - 14 * 24 * 60 * 60 * 1000 + 100,
          level: "info",
          msg: "Source: twitter, Type: urls",
        },
        { ts: now - 14 * 24 * 60 * 60 * 1000 + 200, level: "info", msg: "Starting archive process..." },
        { ts: now - 14 * 24 * 60 * 60 * 1000 + 500, level: "info", msg: "Archive process complete." },
      ],
      details: "Archive generated successfully",
    },
  ];
}
