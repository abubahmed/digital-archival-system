# Digital Archival System

End-to-end tooling to generate a daily issue archive of The Daily Princetonian combining:
- Mailchimp newsletters (PDF capture + cleaned text)
- Website articles (PDF capture)
- A merged issue PDF, METS, and ALTO files
- Optional page images (JP2) for METS linkage

A Next.js frontend provides a simple UI to trigger an archive run for a single date or a date range and downloads a ZIP with all artifacts.

## Repository layout

- `frontend/` — Next.js app (UI to run and download archives)
- `lambda/` — Node scripts and handlers for capture, merge, and packaging
  - `handlers/dailyprince.mjs` — Captures articles and prepends newsletters into a single issue PDF; generates ALTO and METS
  - `handlers/newsletter.mjs` — Mailchimp integration; finds newsletters in a window, captures PDFs, extracts/filters text
  - `handlers/instagram.mjs` — Instagram archiving helper (PDFs + metadata)
  - `util/daily_run.mjs` — Builds the list of articles for a window and invokes `dailyPrinceHandler`
  - `util/run_daily_archive.mjs` — CLI entry used by the frontend API route
  - `util/mets_alto_dp.mjs` — Helpers to generate ALTO pages and a standards-compliant METS file
  - `util/helper.mjs` — S3 helpers, filename/timestamp utils
  - `documents/` — Local output folder when writing to disk (optional)

## Prerequisites

- Node.js 20+
- For newsletter capture: Mailchimp API key and access to the campaign archive
- For optional S3 uploads: AWS credentials with write access to your bucket
 - For optional image generation (JP2): ImageMagick (`magick`) and Ghostscript (`gswin64c`) available on PATH
- Windows users: run frontend in a shell that can spawn Node processes (PowerShell is fine)

### Windows setup: ImageMagick + Ghostscript

JP2 image generation from PDFs uses ImageMagick, which relies on Ghostscript to rasterize PDFs. Install both and ensure they are on PATH.

1) Install Ghostscript (64-bit)
- Download and install the 64-bit Ghostscript for Windows (gswin64c).
- Verify in a new PowerShell window:

```powershell
# Should print Ghostscript version
gswin64c -v
```

2) Install ImageMagick (64-bit)
- Install ImageMagick 7 (Q16 x64).
- During install, enable "Add application directory to your system PATH".
- Verify in a new PowerShell window:

```powershell
# Should print ImageMagick version and delegates
magick -version
```

3) PATH notes
- Typical install paths (adjust versions):
  - C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI\\
  - C:\\Program Files\\gs\\gs10.03.1\\bin\\
- If commands aren’t found, add them to PATH or set for the current session:

```powershell
$env:Path = "C:\\Program Files\\gs\\gs10.03.1\\bin;C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI;" + $env:Path
```

Troubleshooting
- If PDFs fail to convert or you see "no delegate for this image format", confirm `gswin64c -v` works, then reinstall ImageMagick after Ghostscript so it detects it.
- The code calls `magick` from `lambda/handlers/dailyprince.mjs` (pdfToJpegs); `magick` must be available on PATH.

## Environment variables

Used across lambda and/or frontend processes:

- Core
  - `ARCHIVE_TYPE` — one of `cron|instagram|dailyprince|newsletter` when running `lambda/index.mjs` directly
  - `GENERATE_IMAGES` — `true` to write JP2 images and wire them into METS (requires write-to-disk and ImageMagick)
  - `CHROME_PATH` — optional path to Chromium/Chrome for Puppeteer (uses bundled Chromium if unset)
- AWS (optional, for S3 uploads)
  - `AWS_BUCKET_NAME` — target S3 bucket
  - `AWS_BUCKET_REGION` — bucket region
  - `AWS_ACCESS_KEY`, `AWS_SECRET_KEY` — used only when `LOCAL` is truthy
  - `LOCAL` — if set, S3 client uses explicit credentials
- Mailchimp (newsletter handler)
  - `MAILCHIMP_API_KEY` — API key
- Apify (instagram handler)
  - `APIFY_TOKEN` — API token
- Frontend API (date range convenience)
  - `ARCHIVE_START_DATE`, `ARCHIVE_END_DATE` — optional defaults when using the CLI script

Create a `.env` in `lambda/` (and optionally in `frontend/`) to supply these.

## How it works

1) Frontend UI
- `frontend/app/DatePickerRunner.tsx` calls `GET /api/run-archive-zip` with either `?date=YYYY-MM-DD` or `?start=YYYY-MM-DD&end=YYYY-MM-DD`.
- `frontend/app/api/run-archive-zip/route.ts` spawns a Node process to run `lambda/util/run_daily_archive.mjs`, parses the printed JSON, and streams a ZIP containing:
  - Merged issue PDF
  - METS (`mets.xml`)
  - ALTO files (`alto/alto_####.xml`)
  - Optional images (`images/page-####.jp2` when enabled)

2) Article + newsletter capture
- `lambda/util/daily_run.mjs` queries the Daily Princetonian search API for items in window: [start-1 day @ 15:00, end @ 15:00), categorizes and orders them, then calls `dailyPrinceHandler` with a list of URLs and optional titles/contents.
- `lambda/handlers/dailyprince.mjs` uses Puppeteer to PDF each page, prepends Mailchimp newsletter PDFs for the same window, merges all PDFs, and generates ALTO and METS.
- `lambda/handlers/newsletter.mjs` finds all Mailchimp campaigns in the window, captures PDFs, and extracts/filters the plain-text content for ALTO on the first page of each unit.

3) Packaging
- PDF pages are optionally rendered to JP2 via ImageMagick when `GENERATE_IMAGES=true` and write-to-disk is enabled. METS references either real files (when images generated) or logical paths.

## Running the UI

- Install dependencies:
  - In `frontend/`: `npm install`
  - In `lambda/`: `npm install`
- Start the UI:

```powershell
# In frontend/
npm run dev
```

Open http://localhost:3000 and use the form to pick a date or range. A ZIP will download on success, or a small JSON response will indicate "no content" for that window.

## Troubleshooting

- Frontend dev server fails to start
  - Check the terminal output in VS Code (Problems tab or the API route logs). Ensure Node 20+.
- API route error: undici fetch error from daily_run
  - The DP search request can fail transiently. Re-run; ensure you’re online. If reproducible, paste the URL from the logs into a browser to verify access.
- Puppeteer timeouts
  - Some article pages load slowly; the code already retries and relaxes network-idle. Set `CHROME_PATH` to a local Chrome if needed.
- No newsletter captured
  - Ensure `MAILCHIMP_API_KEY` is set. The window is [start-1 day @ 15:00, end @ 15:00); verify campaigns exist in that range.
- JP2/image generation
  - Requires ImageMagick (`magick`) in PATH and `GENERATE_IMAGES=true`. On Windows, install ImageMagick and reopen the terminal.
- S3 uploads
  - Helper functions exist but uploads are disabled in some paths by default. Ensure AWS env vars and remove guards if you want automatic upload.

## Development notes

- The METS and ALTO generators aim for schema-friendly output (LoC ALTO v4; METS with MIX for images). Adjust in `lambda/util/mets_alto_dp.mjs` as needed.
- Newsletter content is filtered via `filterNewsletterText` to remove boilerplate and tracking links.

## License

ISC (see package.json); update as appropriate for your organization.
