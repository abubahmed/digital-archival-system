import { backendClient } from "../../../utils/httpClient";
import type { Jobs, Job, ArchivalConfig, createJobResponse } from "../../../types";
import type { getJobsResponse } from "../../../types";

// GET /api/jobs - List all jobs
export async function GET(req: Request) {
  if (!backendClient) {
    return new Response(JSON.stringify({ error: "Backend API not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await backendClient.get<getJobsResponse>("/jobs");
    const jobs = response.jobs;
    return new Response(JSON.stringify({ jobs, error: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch jobs";
    return new Response(JSON.stringify({ jobs: {}, error: message }), {
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
    const body: ArchivalConfig = await req.json();
    const response = await backendClient.post<createJobResponse>("/jobs", body);
    const job = response.job;
    return new Response(JSON.stringify({ job, error: null }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create job";
    return new Response(JSON.stringify({ job: null, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
