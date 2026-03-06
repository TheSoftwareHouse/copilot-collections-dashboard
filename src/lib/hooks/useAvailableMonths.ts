"use client";

import { useState, useEffect } from "react";
import type { AvailableMonth } from "@/lib/types";

/**
 * Hook that fetches available months from `/api/dashboard/months`.
 * Eliminates the duplicated useEffect pattern across 5+ panel components.
 */
export function useAvailableMonths(): {
  availableMonths: AvailableMonth[];
  loadingMonths: boolean;
} {
  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
  const [loadingMonths, setLoadingMonths] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchMonths() {
      setLoadingMonths(true);
      try {
        const response = await fetch("/api/dashboard/months");
        if (!response.ok) {
          throw new Error(
            `Failed to load available months (${response.status})`,
          );
        }
        const json = await response.json();
        if (!cancelled) {
          setAvailableMonths(json.months ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch available months:", err);
      } finally {
        if (!cancelled) {
          setLoadingMonths(false);
        }
      }
    }

    fetchMonths();

    return () => {
      cancelled = true;
    };
  }, []);

  return { availableMonths, loadingMonths };
}
