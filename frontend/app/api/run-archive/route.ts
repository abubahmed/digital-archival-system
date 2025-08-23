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

export async function POST(req) {
  try {
    const { date } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid or missing date (use YYYY-MM-DD)" }), { status: 400 });
    }

    // cwd is ...\digital-archival-system\frontend
    const lambdaDir = path.resolve(process.cwd(), "..", "lambda");
    const cliPath   = path.join(lambdaDir, "util", "run_daily_archive.mjs");

    assertExists(lambdaDir, "Lambda cwd");
    assertExists(cliPath, "CLI script");
    assertExists(process.execPath, "Node binary");

    const { code, stdout, stderr } = await runWithNode(cliPath, ["--date", date], { cwd: lambdaDir });

    let payload;
    try { payload = JSON.parse(stdout || "{}"); } catch { payload = { ok: true, raw: stdout }; }

    if (code !== 0) {
      const msg = (stderr || "Archive process failed").trim();
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, ...payload }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500 });
  }
}
