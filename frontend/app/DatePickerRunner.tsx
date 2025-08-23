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

  const [date, setDate] = useState<string>(todayStr);
  const [status, setStatus] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [details, setDetails] = useState<string>("");

  async function runArchive() {
    try {
      setIsRunning(true);
      setStatus("Running…");
      setDetails("");

      const res = await fetch("/api/run-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Request failed with status ${res.status}`);
      }

      setStatus("Done");
      setDetails(JSON.stringify(data, null, 2));
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
            Pick a date. We’ll run the archive for that calendar date using <span className="font-mono">15:00:00</span> local time.
          </p>

          <div className="grid gap-4">
            <label className="text-sm font-medium" htmlFor="date">
              Issue date
            </label>
            <input
              id="date"
              type="date"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayStr}
              required
            />

            <button
              onClick={runArchive}
              disabled={isRunning || !date}
              className="mt-2 inline-flex items-center justify-center rounded-2xl px-4 py-2 text-white bg-black hover:bg-gray-900 disabled:opacity-50"
            >
              {isRunning ? "Running…" : "Run archive"}
            </button>

            <div className="mt-4">
              <div className="text-sm text-gray-700 font-medium">Status:</div>
              <div className="mt-1 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm whitespace-pre-wrap">
                {status || "—"}
              </div>
            </div>

            <div className="mt-2">
              <div className="text-sm text-gray-700 font-medium">Details:</div>
              <pre className="mt-1 rounded-xl bg-gray-50 border border-gray-200 p-3 text-xs overflow-auto max-h-80">
                {details || "(none)"}
              </pre>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Window: <span className="font-mono">yesterday 15:00:00</span> → <span className="font-mono">selected date 15:00:00</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}