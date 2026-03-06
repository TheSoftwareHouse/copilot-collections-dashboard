"use client";

import { useEffect, useState } from "react";

const BANNER_STYLES: Record<string, string> = {
  suspended: "border-yellow-200 bg-yellow-50 text-yellow-800",
  revoked: "border-red-200 bg-red-50 text-red-800",
  not_installed: "border-gray-200 bg-gray-50 text-gray-800",
  unknown: "border-yellow-200 bg-yellow-50 text-yellow-800",
};

export default function ConnectionHealthBanner() {
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/github-app/status");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setConnectionStatus(data.connectionStatus);
          setStatusMessage(data.statusMessage);
        }
      } catch {
        // Silently ignore fetch errors
      }
    }

    fetchStatus();

    const interval = setInterval(fetchStatus, 60_000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchStatus();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!connectionStatus || connectionStatus === "active" || !statusMessage) {
    return null;
  }

  const bannerClass = BANNER_STYLES[connectionStatus] ?? BANNER_STYLES.unknown;

  return (
    <div role="alert" className={`border-b ${bannerClass} px-4 py-3`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <p className="text-sm">{statusMessage}</p>
        <a
          href="/management?tab=configuration"
          className="text-sm font-medium underline whitespace-nowrap ml-4"
        >
          Go to Settings
        </a>
      </div>
    </div>
  );
}
