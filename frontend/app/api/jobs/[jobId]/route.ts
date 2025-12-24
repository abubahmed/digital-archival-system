export const runtime = "nodejs";

import { backendClient } from "../../../../utils/httpClient";

interface JobDetailResponse {
  id: string;
  createdAt: number;
  config: {
    source: string;
    archivalType: string;
  };
  state: "idle" | "running" | "success" | "error";
  statusText: string;
  logs: Array<{
    ts: number;
    level: string;
    msg: string;
  }>;
  downloadUrl?: string;
}

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
    const url = new URL(req.url);
    const authToken = url.searchParams.get("authToken") || req.headers.get("Authorization")?.replace("Bearer ", "");

    const response = await backendClient.get<JobDetailResponse>(`/jobs/${jobId}`, authToken || undefined);
    return new Response(JSON.stringify(response), {
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
