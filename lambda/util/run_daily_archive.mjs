#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import log from "./logger.mjs";
// Force reload by appending timestamp to import
const timestamp = Date.now();
const { createTodaysArchive } = await import(`./daily_run.mjs?t=${timestamp}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const LAMBDA_ROOT = path.resolve(__dirname, ".."); // …/lambda

// Ensure all relative paths and dotenv look in lambda/
process.chdir(LAMBDA_ROOT);
dotenv.config({ path: path.join(LAMBDA_ROOT, ".env") });

function die(msg, code = 1) { log.error(msg); process.exit(code); }

// Usage: node util/run_daily_archive.mjs --date 2023-04-26
const args = new Map(
  process.argv.slice(2).map((v, i, a) => (v.startsWith("--") ? [v.slice(2), a[i + 1]] : null)).filter(Boolean)
);
let date = args.get("date") || process.env.ARCHIVE_DATE;

async function main() {
  log.info('Starting archive process');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    log.error('Invalid date format');
    die("Provide --date YYYY-MM-DD");
  }
  
  const [y, m, d] = date.split("-");
  try {
    log.info(`Processing date: ${date}`);
    const result = await createTodaysArchive({
      event: { day: Number(d), month: Number(m), year: Number(y) },
      callback: undefined,
      context: undefined,
    });
    
    if (!result) {
      log.error('No result returned from runner');
      die("Runner returned no result");
    }

    log.info('Archive process completed successfully');
    
    // Log each component of the result separately for clarity
    log.info({
      issueName: result.issueName,
      issueDate: result.issueDate,
      ok: result.ok,
      artifacts: {
        pdf: result.artifacts?.pdf?.name,
        mets: result.artifacts?.mets?.name,
        altoCount: result.artifacts?.alto?.length
      }
    }, 'Archive generation details');
    
  } catch (err) {
    const errorMsg = err?.stack || String(err);
    log.error(`Archive process failed: ${errorMsg}`);
    process.exit(1);
  }
}

// Add error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  log.fatal('Uncaught exception:', err);
  process.exit(1);
});

main();
