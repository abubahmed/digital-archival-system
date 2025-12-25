import { backendClient } from "../../../../utils/httpClient";
import type { Job } from "../../../../types";

// GET /api/jobs/[jobId] - Get specific job details
export async function GET(req: Request, { params }: { params: { jobId: string } }) {
  if (!backendClient) {
    return new Response(JSON.stringify({ error: "Backend API not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { jobId } = params;
    const job = await backendClient.get<Job>(`/jobs/${jobId}`);
    return new Response(JSON.stringify(job), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch job";
    const status = error instanceof Error && error.message.includes("404") ? 404 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
