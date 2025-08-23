#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createTodaysArchive } from "./daily_run.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const LAMBDA_ROOT = path.resolve(__dirname, ".."); // …/lambda

// Ensure all relative paths and dotenv look in lambda/
process.chdir(LAMBDA_ROOT);
dotenv.config({ path: path.join(LAMBDA_ROOT, ".env") });

function die(msg, code = 1) { console.error(msg); process.exit(code); }

// Usage: node util/run_daily_archive.mjs --date 2023-04-26
const args = new Map(
  process.argv.slice(2).map((v, i, a) => (v.startsWith("--") ? [v.slice(2), a[i + 1]] : null)).filter(Boolean)
);
let date = args.get("date") || process.env.ARCHIVE_DATE;

async function main() {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) die("Provide --date YYYY-MM-DD");
  const [y, m, d] = date.split("-");
  try {
    const result = await createTodaysArchive({
      event: { day: Number(d), month: Number(m), year: Number(y) },
      callback: undefined,
      context: undefined,
    });
    if (!result || !result.artifacts) die("Runner returned no artifacts");
    // The ONLY JSON on stdout so API/ZIP can parse it:
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}
main();
