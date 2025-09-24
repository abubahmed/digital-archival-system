"use client";

import React, { useMemo, useState } from "react";

export default function DatePickerRunner() {
  const todayStr = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Single date or range controls
  const [isRange, setIsRange] = useState(false);
  const [date, setDate] = useState<string>(todayStr);
  const [start, setStart] = useState<string>(todayStr);
  const [end, setEnd] = useState<string>(todayStr);
  const [status, setStatus] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [details, setDetails] = useState<string>("");
  const [debug, setDebug] = useState(false);
  const [zipReady, setZipReady] = useState(false);

  function prettyDetails(data: any) {
    const keep: Record<string, any> = {};
    for (const k of ["summary", "counts", "issueDate", "issueName", "files"]) {
      if (data && data[k] != null) keep[k] = data[k];
    }
    if (Object.keys(keep).length > 0) return JSON.stringify(keep, null, 2);
    if (debug && data?.raw) return data.raw;
    return "(success)";
  }

  async function generateArchive() {
    try {
      setIsRunning(true);
      setStatus("Generating archive...");
      setDetails("");

      // Build URL for single date or range
      const qs = isRange
        ? `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
        : `date=${encodeURIComponent(date)}`;
      const url = `/api/run-archive-zip?${qs}${debug ? "&debug=1" : ""}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with status ${res.status}`);
      }

      // Check if it's JSON (no content case) or ZIP (success with content)
      const contentType = res.headers.get('Content-Type') || '';
      
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.noContent) {
          setStatus("Done");
          setDetails(data.message || "No articles found for this date");
          return;
        }
      }

  // If we get here, it's a ZIP file
      const disposition = res.headers.get('Content-Disposition');
      const label = isRange ? `${start}_to_${end}` : date;
      const filename = disposition?.split('filename=')[1]?.replace(/"/g, '') || `dailyprince-${label}.zip`;

      // Create a download link and click it
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      setStatus("Archive downloaded successfully");
      setDetails("Archive has been generated and downloaded.");
      setZipReady(true);
    } catch (err: any) {
      setStatus("Failed");
      setDetails(String(err?.message || err));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-white text-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="rounded-2xl shadow-lg border border-gray-200 p-6">
          <h1 className="text-2xl font-semibold mb-2">Create Daily Archive</h1>
          <p className="text-sm text-gray-600 mb-6">
            Pick a date or a range. We’ll run the archive for the selected window using <span className="font-mono">15:00:00</span> local time.
          </p>

          <div className="grid gap-4">
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="radio" name="mode" checked={!isRange} onChange={() => setIsRange(false)} />
                Single day
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="radio" name="mode" checked={isRange} onChange={() => setIsRange(true)} />
                Date range
              </label>
            </div>

            {!isRange ? (
              <div>
                <label className="text-sm font-medium" htmlFor="date">Issue date</label>
                <input
                  id="date"
                  type="date"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={todayStr}
                  required
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium" htmlFor="start">Start date</label>
                  <input
                    id="start"
                    type="date"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    max={end || todayStr}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="end">End date</label>
                  <input
                    id="end"
                    type="date"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    min={start}
                    max={todayStr}
                    required
                  />
                </div>
              </div>
            )}

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={debug}
                onChange={(e) => setDebug(e.target.checked)}
              />
              Show debug log
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={generateArchive}
                disabled={isRunning || (!isRange && !date) || (isRange && (!start || !end))}
                className="mt-2 inline-flex items-center justify-center rounded-2xl px-4 py-2 text-white bg-black hover:bg-gray-900 disabled:opacity-50"
              >
                {isRunning ? "Generating..." : "Generate Archive"}
              </button>
            </div>

            <div className="mt-4">
              <div className="text-sm text-gray-700 font-medium">Status:</div>
              <div className="mt-1 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm whitespace-pre-wrap">
                {status || "—"}
              </div>
            </div>

            <div className="mt-2">
              <div className="text-sm text-gray-700 font-medium">Details:</div>
              <pre className="mt-1 rounded-xl bg-gray-50 border border-gray-200 p-3 text-xs overflow-auto max-h-80 break-words">
                {details || "(none)"}
              </pre>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Window: <span className="font-mono">start-1 day 15:00:00</span> → <span className="font-mono">end date 15:00:00</span> (for single day, start=end).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}