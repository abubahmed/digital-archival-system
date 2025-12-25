// GET /api/jobs/[jobId]/stream - Proxy SSE stream for job updates
export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL;

  if (!BACKEND_API_URL) {
    return new Response("Backend API not configured", { status: 503 });
  }

  try {
    const { jobId } = await params;
    const backendUrl = `${BACKEND_API_URL}/jobs/${jobId}/stream`;

    // Forward the SSE request to the backend
    const backendResponse = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!backendResponse.ok) {
      return new Response(`Backend error: ${backendResponse.statusText}`, {
        status: backendResponse.status,
      });
    }

    // Create a ReadableStream to pipe the SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const reader = backendResponse.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        } catch (error) {
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to stream job updates";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
