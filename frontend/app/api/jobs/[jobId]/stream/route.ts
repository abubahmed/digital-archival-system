// GET /api/jobs/[jobId]/stream - Proxy SSE stream for job updates
export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL;

  if (!BACKEND_API_URL) {
    return new Response("Backend API not configured", { status: 503 });
  }

  try {
    const { jobId } = await params;
    const backendUrl = `${BACKEND_API_URL}/jobs/${jobId}/stream`;

    const backendResponse = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
      },
      signal: req.signal,
    });

    if (!backendResponse.ok) {
      return new Response(`Backend error: ${backendResponse.statusText}`, {
        status: backendResponse.status,
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = backendResponse.body?.getReader();
        const decoder = new TextDecoder();
        controller.enqueue(new TextEncoder().encode(":ok\n\n"));

        if (!reader) {
          controller.close();
          return;
        }

        req.signal.addEventListener("abort", () => {
          reader.cancel().catch(() => {});
          controller.close();
        });

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        } catch (error) {
          if (error instanceof Error && error.name !== "AbortError") {
            controller.error(error);
          }
        } finally {
          reader.cancel().catch(() => {});
          controller.close();
        }
      },
      cancel() {
        backendResponse.body?.cancel().catch(() => {});
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
