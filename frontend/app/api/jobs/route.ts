/**
 * Get all jobs.
 *
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 *
 * @file route.ts
 */

import { backendClient } from "../../../utils/httpClient";
import type { Jobs, Job, ArchivalConfig, createJobResponse } from "../../../types";
import type { getJobsResponse } from "../../../types";

/**
 * GET /api/jobs - List all jobs
 *
 * @param {Request} req - The request object.
 *
 * @returns {Response} The response object.
 */
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

/**
 * POST /api/jobs - Create/start a new archival job
 *
 * @param {Request} req - The request object.
 *
 * @returns {Response} The response object.
 */
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
