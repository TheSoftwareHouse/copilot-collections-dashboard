"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRelativeTime, formatTimestamp } from "@/lib/format-helpers";

export interface JobExecutionData {
  status: string;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  recordsProcessed: number | null;
}

interface JobStatusPanelProps {
  data: {
    seatSync: JobExecutionData | null;
    usageCollection: JobExecutionData | null;
  };
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bgClass: string; textClass: string }
> = {
  success: {
    label: "Success",
    bgClass: "bg-green-100",
    textClass: "text-green-800",
  },
  failure: {
    label: "Failed",
    bgClass: "bg-red-100",
    textClass: "text-red-800",
  },
  running: {
    label: "Running",
    bgClass: "bg-yellow-100",
    textClass: "text-yellow-800",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    bgClass: "bg-gray-100",
    textClass: "text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}
      aria-label={`Status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}

export function JobCard({
  title,
  execution,
  action,
}: {
  title: string;
  execution: JobExecutionData | null;
  action?: React.ReactNode;
}) {
  if (!execution) {
    return (
      <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {action}
        </div>
        <div className="mt-3">
          <span
            className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
            aria-label="Status: No runs yet"
          >
            No runs yet
          </span>
          <p className="mt-2 text-sm text-gray-500">No runs recorded yet</p>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {action}
          <StatusBadge status={execution.status} />
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Started</dt>
          <dd
            className="text-gray-900"
            title={formatTimestamp(execution.startedAt)}
          >
            {formatRelativeTime(execution.startedAt)}
          </dd>
        </div>

        {execution.completedAt && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Completed</dt>
            <dd
              className="text-gray-900"
              title={formatTimestamp(execution.completedAt)}
            >
              {formatRelativeTime(execution.completedAt)}
            </dd>
          </div>
        )}

        {execution.recordsProcessed != null && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Records processed</dt>
            <dd className="text-gray-900">{execution.recordsProcessed}</dd>
          </div>
        )}
      </dl>

      {execution.errorMessage && (
        <div
          className={`mt-3 rounded-md border p-3 ${
            execution.status === "failure"
              ? "bg-red-50 border-red-200"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              execution.status === "failure"
                ? "text-red-800"
                : "text-yellow-800"
            }`}
          >
            {execution.status === "failure" ? "Error details" : "Warnings"}
          </p>
          <p
            className={`mt-1 text-sm ${
              execution.status === "failure"
                ? "text-red-700"
                : "text-yellow-700"
            }`}
          >
            {execution.errorMessage}
          </p>
        </div>
      )}
    </article>
  );
}

export function SyncNowButton({ onComplete }: { onComplete?: () => void } = {}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/jobs/seat-sync", { method: "POST" });

      if (response.status === 401) {
        setMessage({ type: "error", text: "Session expired. Please log in again." });
        return;
      }

      const body = await response.json();

      if (response.status === 409) {
        setMessage({ type: "error", text: body.error });
        return;
      }

      if (body.status === "success") {
        setMessage({
          type: "success",
          text: `Synced ${body.recordsProcessed} seat${body.recordsProcessed === 1 ? "" : "s"}`,
        });
        router.refresh();
        onComplete?.();
      } else if (body.status === "failure") {
        setMessage({ type: "error", text: body.errorMessage || "Sync failed" });
        router.refresh();
        onComplete?.();
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        aria-label="Trigger seat sync"
        className="inline-flex items-center rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {syncing ? (
          <>
            <svg
              className="mr-1 h-3 w-3 animate-spin"
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
            Syncing…
          </>
        ) : (
          "Sync Now"
        )}
      </button>
      {message && (
        <span
          className={`text-xs ${message.type === "success" ? "text-green-700" : "text-red-700"}`}
          role="status"
        >
          {message.text}
        </span>
      )}
    </div>
  );
}

export function CollectNowButton({ onComplete }: { onComplete?: () => void } = {}) {
  const router = useRouter();
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleCollect() {
    setCollecting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/jobs/usage-collection", {
        method: "POST",
      });

      if (response.status === 401) {
        setMessage({
          type: "error",
          text: "Session expired. Please log in again.",
        });
        return;
      }

      const body = await response.json();

      if (response.status === 409) {
        setMessage({ type: "error", text: body.error });
        return;
      }

      if (body.status === "success") {
        const errorSuffix =
          body.usersErrored > 0
            ? ` (${body.usersErrored} errored)`
            : "";
        setMessage({
          type: "success",
          text: `Collected ${body.recordsProcessed} record${body.recordsProcessed === 1 ? "" : "s"} for ${body.usersProcessed} user${body.usersProcessed === 1 ? "" : "s"}${errorSuffix}`,
        });
        router.refresh();
        onComplete?.();
      } else if (body.status === "failure") {
        setMessage({
          type: "error",
          text: body.errorMessage || "Collection failed",
        });
        router.refresh();
        onComplete?.();
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setCollecting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCollect}
        disabled={collecting}
        aria-label="Trigger usage collection"
        className="inline-flex items-center rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {collecting ? (
          <>
            <svg
              className="mr-1 h-3 w-3 animate-spin"
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
            Collecting…
          </>
        ) : (
          "Collect Now"
        )}
      </button>
      {message && (
        <span
          className={`text-xs ${message.type === "success" ? "text-green-700" : "text-red-700"}`}
          role="status"
        >
          {message.text}
        </span>
      )}
    </div>
  );
}

export default function JobStatusPanel({ data }: JobStatusPanelProps) {
  return (
    <section aria-label="Background job status">
      <h2 className="text-lg font-semibold text-gray-900">
        Background Job Status
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Status of the latest sync and collection job runs.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <JobCard
          title="Seat Sync"
          execution={data.seatSync}
          action={<SyncNowButton />}
        />
        <JobCard title="Usage Collection" execution={data.usageCollection} action={<CollectNowButton />} />
      </div>
    </section>
  );
}
