"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface InstallCompleteProps {
  installationId: string;
}

interface SuccessData {
  entityName: string;
  apiMode: string;
  installationId: number;
}

export default function InstallComplete({ installationId }: InstallCompleteProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAlreadyInstalled, setIsAlreadyInstalled] = useState(false);

  const processInstallation = useCallback(async (id: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/github-app/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId: id }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data);
      } else if (response.status === 409) {
        setIsAlreadyInstalled(true);
      } else {
        setError(data.error || "Failed to process installation");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  useEffect(() => {
    processInstallation(installationId);
  }, [installationId, processInstallation]);

  if (isProcessing) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent" />
        <p className="mt-4 text-sm text-gray-600">
          Connecting to your organisation…
        </p>
      </div>
    );
  }

  if (success) {
    const typeLabel = success.apiMode === "enterprise" ? "Enterprise" : "Organisation";

    return (
      <div className="rounded-md bg-green-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-green-800">
          Organisation connected successfully
        </h2>
        <p className="mt-2 text-sm text-green-700">
          Connected to: <strong>{success.entityName}</strong>
        </p>
        <p className="mt-1 text-sm text-green-700">
          Type: {typeLabel}
        </p>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mt-4 block w-full rounded-md bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Continue to Dashboard
        </button>
      </div>
    );
  }

  if (isAlreadyInstalled) {
    return (
      <div className="rounded-md bg-blue-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-blue-800">
          Setup already complete
        </h2>
        <p className="mt-2 text-sm text-blue-700">
          The GitHub App is already installed and configured.
        </p>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mt-4 block w-full rounded-md bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-red-50 p-6 text-center">
      <p className="text-sm text-red-800">{error}</p>
      <button
        type="button"
        onClick={() => router.push("/setup")}
        className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Try Again
      </button>
    </div>
  );
}
