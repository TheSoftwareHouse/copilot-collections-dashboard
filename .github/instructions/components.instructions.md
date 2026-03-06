---
name: 'Component Conventions'
description: 'React client component patterns, data fetching, loading/error states, Tailwind styling, and accessibility conventions. Applied when working on UI components.'
applyTo: 'src/components/**/*.tsx'
---

# Client Component Pattern

Every component in `src/components/` is a client component. No exceptions.

## File Structure

```tsx
"use client";

import { useState, useEffect } from "react";

interface PanelProps {
  month: number;
  year: number;
}

export default function Panel({ month, year }: PanelProps) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`/api/data?month=${month}&year=${year}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (!cancelled) { setData(json); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "Error"); setLoading(false); }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [month, year]);

  if (loading) return <div role="status">Loading...</div>;
  if (error) return <div role="alert">{error}</div>;
  if (!data) return null;

  return <div>...</div>;
}
```

## Rules

- `"use client"` directive at the top of every file
- `export default function ComponentName()` — always default export
- Props defined as inline interface: `ComponentNameProps`
- Data fetching via `useState` + `useEffect` with `cancelled` flag — no SWR or React Query
- Three-state rendering: loading → error → data
- ARIA roles: `role="status"` for loading states, `role="alert"` for error states

## Styling

- Tailwind CSS utility classes inline — no CSS modules, no styled-components
- Use `@/` path alias for all imports

## Sub-Components

Helper components used only in one file are defined as functions in the same file, not exported:

```tsx
function StatusBadge({ status }: { status: string }) {
  return <span className="...">{status}</span>;
}

export default function SeatList() {
  return <StatusBadge status="active" />;
}
```

## Organization

Components organized by domain folder:
- `usage/` — usage statistics components
- `dashboard/` — dashboard panels
- `teams/` — team management components  
- `shared/` — reusable components (Modal, etc.)
