export const runtime = "nodejs";

import { backendClient } from "../../../utils/httpClient";
import type { Source, ArchivalType } from "../../../types";

interface CreateJobRequest {
  source: Source;
  archivalType: ArchivalType;
  authToken: string;
  date?: string;
  dateStartTime?: string;
  dateEndTime?: string;
  start?: string;
  end?: string;
  startTime?: string;
  endTime?: string;
  urls?: string[];
  mostRecentCount?: number;
  mostRecentSince?: string;
}

interface JobResponse {
  id: string;
  createdAt: number;
  config: {
    source: Source;
    archivalType: ArchivalType;
  };
  state: "idle" | "running" | "success" | "error";
  statusText: string;
  downloadUrl?: string;
}

interface JobListResponse {
  jobs: Omit<JobResponse, "downloadUrl">[];
}

interface CreateJobResponse {
  jobId: string;
}

// GET /api/jobs - List all jobs
export async function GET(req: Request) {
  if (!backendClient) {
    return new Response(JSON.stringify({ error: "Backend API not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const authToken = url.searchParams.get("authToken") || req.headers.get("Authorization")?.replace("Bearer ", "");

    const response = await backendClient.get<JobListResponse>("/jobs", authToken || undefined);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch jobs";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// POST /api/jobs - Create/start a new archival job
export async function POST(req: Request) {
  if (!backendClient) {
    return new Response(JSON.stringify({ error: "Backend API not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: CreateJobRequest = await req.json();
    const { authToken, ...jobConfig } = body;

    const response = await backendClient.post<CreateJobResponse>("/jobs", jobConfig, authToken);
    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create job";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
