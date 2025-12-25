import { backendClient } from "../../../../utils/httpClient";
import type { getJobResponse } from "../../../../types";

// GET /api/jobs/[jobId] - Get specific job details
export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!backendClient) {
    return new Response(JSON.stringify({ error: "Backend API not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { jobId } = await params;
    const response = await backendClient.get<getJobResponse>(`/jobs/${jobId}`);
    const job = response.job;
    return new Response(JSON.stringify({ job, error: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch job";
    const status = error instanceof Error && error.message.includes("404") ? 404 : 500;
    return new Response(JSON.stringify({ job: null, error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
