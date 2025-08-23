export const runtime = "nodejs";

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import JSZip from "jszip";

function assertExists(p, label) {
  if (!fs.existsSync(p)) throw new Error(`${label} not found: ${p}`);
}

function runWithNode(scriptPath, args = [], { cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function parseLastJson(stdout = "") {
  const matches = stdout.match(/{[\s\S]*}/g);
  if (!matches) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    try { return JSON.parse(matches[i]); } catch {}
  }
  return null;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response("Invalid or missing date (use YYYY-MM-DD)", { status: 400 });
    }

    // cwd is .../digital-archival-system/frontend
    const lambdaDir = path.resolve(process.cwd(), "..", "lambda");
    const cliPath   = path.join(lambdaDir, "util", "run_daily_archive.mjs");

    assertExists(lambdaDir, "Lambda cwd");
    assertExists(cliPath, "CLI script");
    assertExists(process.execPath, "Node binary");

    // Run the archiver (idempotent) and parse its manifest
    const { code, stdout, stderr } = await runWithNode(
      cliPath,
      ["--date", date],
      { cwd: lambdaDir }
    );
    if (code !== 0) return new Response((stderr || "Archive failed").trim(), { status: 500 });

    const payload = parseLastJson(stdout);
    if (!payload?.ok || !payload?.artifacts) {
      return new Response("No artifacts in output", { status: 500 });
    }

    // Build ZIP in memory
    const zip = new JSZip();
    const root = `dailyprince-${date}`;

    // PDF
    if (payload.artifacts.pdf?.data && payload.artifacts.pdf?.name) {
      zip.file(`${root}/${payload.artifacts.pdf.name}`, Buffer.from(payload.artifacts.pdf.data, "base64"));
    }

    // METS
    if (payload.artifacts.mets?.data && payload.artifacts.mets?.name) {
      zip.file(`${root}/mets/${payload.artifacts.mets.name}`, Buffer.from(payload.artifacts.mets.data, "base64"));
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

    return new Response(zipBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${root}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(String(err?.message || err), { status: 500 });
  }
}
