// route.mjs
export const runtime = "nodejs";

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

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

// Pull the *last* JSON object out of mixed stdout
function parseLastJson(stdout = "") {
  const matches = stdout.match(/{[\s\S]*}/g);
  if (!matches) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    try { return JSON.parse(matches[i]); } catch { /* keep trying */ }
  }
  return null;
}

export async function POST(req) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    const { date } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid or missing date (use YYYY-MM-DD)" }),
        { status: 400 }
      );
    }

    // cwd is .../digital-archival-system/frontend
    const lambdaDir = path.resolve(process.cwd(), "..", "lambda");
    const cliPath   = path.join(lambdaDir, "util", "run_daily_archive.mjs");

    assertExists(lambdaDir, "Lambda cwd");
    assertExists(cliPath, "CLI script");
    assertExists(process.execPath, "Node binary");

    const { code, stdout, stderr } = await runWithNode(
      cliPath,
      ["--date", date],
      { cwd: lambdaDir }
    );

    if (code !== 0) {
      const msg = (stderr || "Archive process failed").trim();
      // truncate noisy errors
      const short = msg.length > 1500 ? msg.slice(0, 1500) + "… (truncated)" : msg;
      return new Response(JSON.stringify({ ok: false, error: short }), { status: 500 });
    }

    // Success: prefer structured JSON, otherwise keep it minimal
    const payload = parseLastJson(stdout) || {};
    const resp = { ok: true, ...payload };

    // Only include raw log in explicit debug mode
    if (debug) {
      const raw = stdout.length > 5000 ? stdout.slice(0, 5000) + "… (truncated)" : stdout;
      resp.raw = raw;
    }

    return new Response(JSON.stringify(resp), { status: 200 });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message || err) }),
      { status: 500 }
    );
  }
}