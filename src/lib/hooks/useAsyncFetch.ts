"use client";

import { useState, useEffect } from "react";

interface UseAsyncFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Generic hook that fetches JSON from a URL with a cancelled-flag guard.
 * Re-fetches whenever `url` changes (include query params in the url string).
 */
export function useAsyncFetch<T>(url: string): UseAsyncFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to load data (${response.status})`);
        }

        const json: T = await response.json();

        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}
