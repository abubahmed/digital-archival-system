export const runtime = "nodejs";

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import JSZip from "jszip";

function assertExists(p: string, label: string) {
  if (!fs.existsSync(p)) throw new Error(`${label} not found: ${p}`);
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runWithNode(scriptPath: string, args: string[] = [], { cwd }: { cwd?: string } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "",
      stderr = "";

    child.stdout.on("data", (d) => {
      const data = d.toString();
      stdout += data;
      console.log(`[Child Process stdout] ${data}`);
    });

    child.stderr.on("data", (d) => {
      const data = d.toString();
      stderr += data;
      console.error(`[Child Process stderr] ${data}`);
    });

    child.on("close", (code) => {
      console.log(`Child process exited with code ${code}`);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

function parseLastJson(stdout = "") {
  // Look for our marked JSON block
  const markerMatch = stdout.match(/=== BEGIN ARCHIVE RESULT JSON ===\n([\s\S]*?)\n=== END ARCHIVE RESULT JSON ===/);

  if (markerMatch && markerMatch[1]) {
    try {
      return JSON.parse(markerMatch[1]);
    } catch (e) {
      console.error("Failed to parse marked JSON:", e);
      // Fall through to legacy parsing
    }
  }

  // Legacy fallback: Find the last complete JSON object in the output
  const matches = stdout.match(/\{[^{}]*\{[^{}]*\}[^{}]*\}|\{[^{}]+\}/g);
  if (!matches) {
    console.error("No JSON objects found in output");
    return null;
  }

  // Try parsing from last to first to get the most recent complete JSON
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(matches[i]);
    } catch (e) {
      continue;
    }
  }

  console.error("Failed to parse any JSON objects from output");
  return null;
}

export async function GET(req: Request) {
  console.log("Starting ZIP download process...");
  try {
    const url = new URL(req.url);

    // Validate auth token - check Authorization header or token query parameter
    const authHeader = req.headers.get("Authorization");
    const tokenParam = url.searchParams.get("token");
    const authToken = authHeader?.replace("Bearer ", "") || tokenParam;

    if (!authToken || !authToken.trim()) {
      return new Response("Authentication token is required.", { status: 401 });
    }

    // Support either single date (?date=YYYY-MM-DD) or range
    const date = url.searchParams.get("date");
    const startQuery = url.searchParams.get("start") || url.searchParams.get("startDate");
    const endQuery = url.searchParams.get("end") || url.searchParams.get("endDate");

    const isValid = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

    let start: string | null = null;
    let end: string | null = null;

    if (date && isValid(date)) {
      start = date;
      end = date;
    } else if (isValid(startQuery) && isValid(endQuery)) {
      start = startQuery!;
      end = endQuery!;
    } else {
      return new Response("Invalid or missing date(s). Use ?date=YYYY-MM-DD or ?start=YYYY-MM-DD&end=YYYY-MM-DD", {
        status: 400,
      });
    }

    // cwd is .../digital-archival-system/frontend
    const lambdaDir = path.resolve(process.cwd(), "..", "lambda");
    const cliPath = path.join(lambdaDir, "util", "run_daily_archive.mjs");

    assertExists(lambdaDir, "Lambda cwd");
    assertExists(cliPath, "CLI script");
    assertExists(process.execPath, "Node binary");

    // Run the archiver (idempotent) and parse its manifest
    const { code, stdout, stderr } = await runWithNode(cliPath, ["--start", start!, "--end", end!], { cwd: lambdaDir });
    if (code !== 0) return new Response((stderr || "Archive failed").trim(), { status: 500 });

    console.log("Attempting to parse JSON from stdout");
    const payload = parseLastJson(stdout);
    console.log("Parsed payload:", payload);

    if (!payload?.ok) {
      console.error("Payload missing or not ok:", payload);
      return new Response("Invalid payload structure", { status: 500 });
    }

    if (payload.noContent) {
      // Return a 200 with a JSON response indicating no content
      return new Response(
        JSON.stringify({
          ok: true,
          noContent: true,
          message: payload.message || "No content available for this date",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!payload?.artifacts) {
      console.error("Expected artifacts but none found in payload:", payload);
      return new Response("No artifacts in payload", { status: 500 });
    }

    // Build ZIP in memory
    const zip = new JSZip();
    const rangeSuffix = start === end ? start : `${start}_to_${end}`;
    const root = `dailyprince-${rangeSuffix}`;

    console.log("Starting ZIP creation with artifacts:", {
      hasPDF: !!payload.artifacts.pdf?.data,
      hasMETS: !!payload.artifacts.mets?.data,
      altoCount: payload.artifacts.alto?.length,
    });

    // PDF
    if (payload.artifacts.pdf?.data && payload.artifacts.pdf?.name) {
      zip.file(`${root}/${payload.artifacts.pdf.name}`, Buffer.from(payload.artifacts.pdf.data, "base64"));
    }

    // METS
    if (payload.artifacts.mets?.data && payload.artifacts.mets?.name) {
      zip.file(`${root}/${payload.artifacts.mets.name}`, Buffer.from(payload.artifacts.mets.data, "base64"));
    }

    // ALTO
    if (Array.isArray(payload.artifacts.alto)) {
      for (const a of payload.artifacts.alto) {
        if (a?.data && a?.name) {
          zip.file(`${root}/alto/${a.name}`, Buffer.from(a.data, "base64"));
        }
      }
    }

    // Images (optional, if you add them later)
    if (Array.isArray(payload.artifacts.images)) {
      for (const img of payload.artifacts.images) {
        if (img?.data && img?.name) {
          zip.file(`${root}/images/${img.name}`, Buffer.from(img.data, "base64"));
        }
      }
    }

    const zipBytes = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    return new Response(Buffer.from(zipBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${root}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(errorMessage, { status: 500 });
  }
}
