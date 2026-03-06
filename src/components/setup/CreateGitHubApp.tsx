"use client";

import { useState, useEffect, useCallback } from "react";
import { generateManifest } from "@/lib/github-app-manifest";

interface CreateGitHubAppProps {
  code?: string;
  baseUrl?: string;
}

interface SuccessData {
  appName: string;
  appSlug: string;
  htmlUrl: string;
}

export default function CreateGitHubApp({ code, baseUrl: baseUrlProp }: CreateGitHubAppProps) {
  const [isExchanging, setIsExchanging] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exchangeCode = useCallback(async (codeValue: string) => {
    setIsExchanging(true);
    setError(null);

    try {
      const response = await fetch("/api/github-app/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeValue }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data);
      } else {
        setError(data.error || "Failed to create GitHub App");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsExchanging(false);
    }
  }, []);

  useEffect(() => {
    if (code) {
      exchangeCode(code);
    }
  }, [code, exchangeCode]);

  if (isExchanging) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent" />
        <p className="mt-4 text-sm text-gray-600">
          Exchanging code with GitHub…
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-md bg-green-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-green-800">
          GitHub App created successfully
        </h2>
        <p className="mt-2 text-sm text-green-700">
          App name: <strong>{success.appName}</strong>
        </p>
        <a
          href={success.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-indigo-600 underline hover:text-indigo-800"
        >
          View on GitHub
        </a>
        <a
          href={`https://github.com/apps/${success.appSlug}/installations/new`}
          className="mt-4 block w-full rounded-md bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Install GitHub App
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-6 text-center">
        <p className="text-sm text-red-800">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            window.history.replaceState({}, "", "/setup");
          }}
          className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Try Again
        </button>
      </div>
    );
  }

  const baseUrl =
    baseUrlProp ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const manifest = JSON.stringify(generateManifest(baseUrl));

  return (
    <form action="https://github.com/settings/apps/new" method="POST">
      <input type="hidden" name="manifest" value={manifest} />
      <button
        type="submit"
        className="w-full rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Create GitHub App
      </button>
    </form>
  );
}
