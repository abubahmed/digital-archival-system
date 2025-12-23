"use client";

import RadioCard from "./RadioCard";
import {
  computeWindowSingleDay,
  computeWindowRange,
  formatWindowPreview,
  formatLocal,
  isValidYmd,
} from "../utils/dateHelpers";

type Source = "instagram" | "twitter" | "tiktok" | "newsletter" | "dailyPrince" | "dailyPrinceIssues";
type ArchivalType = "singleDay" | "dateRange" | "urls" | "mostRecent";
type Delivery = "download" | "email";
type Schedule = "now" | "later";

interface ConfigurationPanelProps {
  source: Source;
  setSource: (source: Source) => void;
  archivalType: ArchivalType;
  setArchivalType: (type: ArchivalType) => void;
  delivery: Delivery;
  setDelivery: (delivery: Delivery) => void;
  schedule: Schedule;
  setSchedule: (schedule: Schedule) => void;
  date: string;
  setDate: (date: string) => void;
  dateStartTime: string;
  setDateStartTime: (time: string) => void;
  dateEndTime: string;
  setDateEndTime: (time: string) => void;
  start: string;
  setStart: (start: string) => void;
  startTime: string;
  setStartTime: (time: string) => void;
  end: string;
  setEnd: (end: string) => void;
  endTime: string;
  setEndTime: (time: string) => void;
  urlsText: string;
  setUrlsText: (text: string) => void;
  normalizedUrls: string[];
  mostRecentCount: number;
  setMostRecentCount: (count: number) => void;
  mostRecentSince: string;
  setMostRecentSince: (since: string) => void;
  scheduledFor: string;
  setScheduledFor: (forDate: string) => void;
  email: string;
  setEmail: (email: string) => void;
  authToken: string;
  setAuthToken: (token: string) => void;
  rememberAuth: boolean;
  setRememberAuth: (remember: boolean) => void;
  todayStr: string;
  windowPreview: { headline: string; body: string } | null;
  onGenerate: () => void;
  isRunning: boolean;
  validationError: string | null;
}

export default function ConfigurationPanel({
  source,
  setSource,
  archivalType,
  setArchivalType,
  delivery,
  setDelivery,
  schedule,
  setSchedule,
  date,
  setDate,
  dateStartTime,
  setDateStartTime,
  dateEndTime,
  setDateEndTime,
  start,
  setStart,
  startTime,
  setStartTime,
  end,
  setEnd,
  endTime,
  setEndTime,
  urlsText,
  setUrlsText,
  normalizedUrls,
  mostRecentCount,
  setMostRecentCount,
  mostRecentSince,
  setMostRecentSince,
  scheduledFor,
  setScheduledFor,
  email,
  setEmail,
  authToken,
  setAuthToken,
  rememberAuth,
  setRememberAuth,
  todayStr,
  windowPreview,
  onGenerate,
  isRunning,
  validationError,
}: ConfigurationPanelProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
        <p className="mt-1 text-sm text-gray-600">Select source and archival type, then configure details.</p>
      </div>

      <div className="space-y-6 px-6 py-6">
        {/* Source Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="source">
            Source of archival data
          </label>
          <select
            id="source"
            className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}>
            <option value="instagram">Instagram</option>
            <option value="twitter">Twitter / X</option>
            <option value="tiktok">TikTok</option>
            <option value="newsletter">Newsletter</option>
            <option value="dailyPrince">Daily Prince website</option>
            <option value="dailyPrinceIssues">Daily Prince website + newsletter (issues)</option>
          </select>
        </div>

        {/* Archival Type */}
        <div>
          <div className="mb-3">
            <div className="text-sm font-medium text-gray-900">Type of archival</div>
            <div className="text-xs text-gray-600">Choose the selection mode for what to archive.</div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RadioCard
              name="archivalType"
              value="singleDay"
              checked={archivalType === "singleDay"}
              onChange={() => setArchivalType("singleDay")}
              title="Single day"
              subtitle="Previous day start time → selected day end time (EST)"
            />
            <RadioCard
              name="archivalType"
              value="dateRange"
              checked={archivalType === "dateRange"}
              onChange={() => setArchivalType("dateRange")}
              title="Date range"
              subtitle="Start-1 day start time → End day end time (EST)"
            />
            <RadioCard
              name="archivalType"
              value="urls"
              checked={archivalType === "urls"}
              onChange={() => setArchivalType("urls")}
              title="Certain URLs"
              subtitle="Explicit list (one per line)"
            />
            <RadioCard
              name="archivalType"
              value="mostRecent"
              checked={archivalType === "mostRecent"}
              onChange={() => setArchivalType("mostRecent")}
              title="Most recent items"
              subtitle="Latest X items since a date/time"
            />
          </div>
        </div>

        {/* Selection Details */}
        <div className="space-y-4">
          <div className="text-sm font-medium text-gray-900">Selection details</div>

          {archivalType === "singleDay" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700" htmlFor="date">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={todayStr}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700" htmlFor="dateStartTime">
                    Start time (EST)
                  </label>
                  <input
                    id="dateStartTime"
                    type="time"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    value={dateStartTime}
                    onChange={(e) => setDateStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700" htmlFor="dateEndTime">
                    End time (EST)
                  </label>
                  <input
                    id="dateEndTime"
                    type="time"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    value={dateEndTime}
                    onChange={(e) => setDateEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {archivalType === "dateRange" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700" htmlFor="start">
                    Start date
                  </label>
                  <input
                    id="start"
                    type="date"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    max={end || todayStr}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700" htmlFor="end">
                    End date
                  </label>
                  <input
                    id="end"
                    type="date"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    min={start}
                    max={todayStr}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700" htmlFor="startTime">
                    Start time (EST)
                  </label>
                  <input
                    id="startTime"
                    type="time"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700" htmlFor="endTime">
                    End time (EST)
                  </label>
                  <input
                    id="endTime"
                    type="time"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {archivalType === "urls" && (
            <div>
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <label className="block text-xs font-medium text-gray-700" htmlFor="urls">
                    URLs (one per line)
                  </label>
                  <div className="text-xs text-gray-500">Tip: paste from a spreadsheet column</div>
                </div>
                <div className="text-xs text-gray-600">{normalizedUrls.length} parsed</div>
              </div>
              <textarea
                id="urls"
                className="block min-h-32 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="https://example.com/post/123&#10;https://example.com/post/456"
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
              />
            </div>
          )}

          {archivalType === "mostRecent" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-700" htmlFor="count">
                  Most recent X items
                </label>
                <input
                  id="count"
                  type="number"
                  min={1}
                  step={1}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  value={mostRecentCount}
                  onChange={(e) => setMostRecentCount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700" htmlFor="since">
                  Since (local datetime)
                </label>
                <input
                  id="since"
                  type="datetime-local"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  value={mostRecentSince}
                  onChange={(e) => setMostRecentSince(e.target.value)}
                />
              </div>
            </div>
          )}

          {windowPreview && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs font-medium text-gray-700">{windowPreview.headline}</div>
              <div className="mt-1 text-sm text-gray-900">{windowPreview.body}</div>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div>
          <div className="mb-3 text-sm font-medium text-gray-900">Schedule</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RadioCard
              name="schedule"
              value="now"
              checked={schedule === "now"}
              onChange={() => setSchedule("now")}
              title="Run now"
              subtitle="Start immediately"
            />
            <RadioCard
              name="schedule"
              value="later"
              checked={schedule === "later"}
              onChange={() => setSchedule("later")}
              title="Schedule"
              subtitle="Queue for later"
            />
          </div>
          {schedule === "later" && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-700" htmlFor="scheduledFor">
                Scheduled for (local datetime)
              </label>
              <input
                id="scheduledFor"
                type="datetime-local"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Delivery */}
        <div>
          <label className="block text-sm font-medium text-gray-900" htmlFor="delivery">
            Data return type
          </label>
          <select
            id="delivery"
            className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            value={delivery}
            onChange={(e) => setDelivery(e.target.value as Delivery)}>
            <option value="download">Browser download</option>
            <option value="email">Email when complete</option>
          </select>
          {delivery === "email" && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-700" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Auth */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">Authentication</div>
              <div className="text-xs text-gray-600">API key or token (optional)</div>
            </div>
            <div className="text-xs text-gray-600">{authToken ? "Token set" : "No token"}</div>
          </div>
          <input
            id="token"
            type="password"
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            placeholder="Paste token here"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            autoComplete="off"
          />
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={rememberAuth}
              onChange={(e) => setRememberAuth(e.target.checked)}
              className="rounded"
            />
            Remember token in this browser (localStorage)
          </label>
        </div>

        {/* Generate Button */}
        <div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isRunning || !!validationError}
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50">
            {isRunning ? "Generating..." : "Generate Archive"}
          </button>
          {validationError && !isRunning && <p className="mt-2 text-xs text-red-600">{validationError}</p>}
        </div>
      </div>
    </section>
  );
}
