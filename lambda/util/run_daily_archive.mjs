#!/usr/bin/env node
import { createTodaysArchive } from "./daily_run.mjs";

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

// Accept date via argv or env or JSON stdin
// Usage: node run_daily_archive.mjs --date 2023-04-26
const args = new Map(
  process.argv.slice(2).map((v, i, a) => (v.startsWith("--") ? [v.slice(2), a[i + 1]] : null)).filter(Boolean)
);

let date = args.get("date") || process.env.ARCHIVE_DATE;

async function main() {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    die("Provide --date YYYY-MM-DD");
  }
  const [y, m, d] = date.split("-");
  try {
    await createTodaysArchive({
      event: { day: Number(d), month: Number(m), year: Number(y) },
      callback: undefined,
      context: undefined,
    });
    // You can print additional info if your handler returns something.
    console.log(JSON.stringify({ ok: true, ranFor: { day: Number(d), month: Number(m), year: Number(y) } }));
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

main();