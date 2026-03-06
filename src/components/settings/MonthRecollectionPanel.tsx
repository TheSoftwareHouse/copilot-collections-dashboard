"use client";

import { useState } from "react";

import { MONTH_NAMES } from "@/lib/constants";
import { StatusBadge } from "@/components/settings/JobStatusPanel";

const START_YEAR = 2020;

function getCurrentMonth(): number {
  return new Date().getUTCMonth() + 1;
}

function getCurrentYear(): number {
  return new Date().getUTCFullYear();
}

function getYearOptions(): number[] {
  const currentYear = getCurrentYear();
  const years: number[] = [];
  for (let y = currentYear; y >= START_YEAR; y--) {
    years.push(y);
  }
  return years;
}

export default function MonthRecollectionPanel({ lastJobStatus, onComplete, hideHeading }: { lastJobStatus?: string | null; onComplete?: () => void; hideHeading?: boolean }) {
  const [month, setMonth] = useState(getCurrentMonth());
  const [year, setYear] = useState(getCurrentYear());
  const [running, setRunning] = useState(false);
  const [displayStatus, setDisplayStatus] = useState<string | null>(lastJobStatus ?? null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleRecalculate() {
    setRunning(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/jobs/month-recollection?month=${month}&year=${year}`,
        { method: "POST" },
      );

      if (response.status === 401) {
        setMessage({
          type: "error",
          text: "Session expired. Please log in again.",
        });
        return;
      }

      const body = await response.json();

      if (response.status === 400 || response.status === 409) {
        setMessage({ type: "error", text: body.error });
        return;
      }

      if (!response.ok) {
        setMessage({
          type: "error",
          text: body.error || "An unexpected error occurred.",
        });
        return;
      }

      if (body.status === "success") {
        setDisplayStatus("success");
        const errorSuffix =
          body.usersErrored > 0 ? ` (${body.usersErrored} errored)` : "";
        setMessage({
          type: "success",
          text: `Recollected ${body.recordsProcessed} record${body.recordsProcessed === 1 ? "" : "s"} for ${body.usersProcessed} user${body.usersProcessed === 1 ? "" : "s"}${errorSuffix}`,
        });
      } else if (body.status === "failure") {
        setDisplayStatus("failure");
        setMessage({
          type: "error",
          text: body.errorMessage || "Recollection failed",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setRunning(false);
      onComplete?.();
    }
  }

  return (
    <section aria-label="Month recollection">
      {hideHeading ? (
        displayStatus && (
          <div className="mb-3">
            <StatusBadge status={displayStatus} />
          </div>
        )
      ) : (
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              Month Data Recollection
            </h2>
            {displayStatus && <StatusBadge status={displayStatus} />}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Re-fetch usage data from GitHub for every seat and every day of the
            selected month. This will overwrite existing data for that period.
          </p>
        </>
      )}

      <div className={`${hideHeading ? "" : "mt-4 "}rounded-lg border border-gray-200 bg-white p-5 shadow-sm`}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="recollection-month"
              className="block text-sm font-medium text-gray-700"
            >
              Month
            </label>
            <select
              id="recollection-month"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              disabled={running}
              className="mt-1 block w-40 rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={index + 1} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="recollection-year"
              className="block text-sm font-medium text-gray-700"
            >
              Year
            </label>
            <select
              id="recollection-year"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              disabled={running}
              className="mt-1 block w-28 rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              {getYearOptions().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleRecalculate}
            disabled={running}
            aria-label="Trigger month recollection"
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <svg
                  className="mr-1.5 h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Recalculating…
              </>
            ) : (
              "Recalculate Month"
            )}
          </button>
        </div>

        {message && (
          <div className="mt-4">
            <span
              className={`text-sm ${message.type === "success" ? "text-green-700" : "text-red-700"}`}
              role={message.type === "error" ? "alert" : "status"}
            >
              {message.text}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
