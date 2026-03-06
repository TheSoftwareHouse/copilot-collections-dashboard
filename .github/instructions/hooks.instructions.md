---
name: 'Hook Conventions'
description: 'Custom React hook patterns, naming, return types, cancelled-flag cleanup, and options pattern. Applied when working on hook files.'
applyTo: 'src/lib/hooks/**/*.ts'
---

# Custom Hook Conventions

All hooks are client-side — every file starts with `"use client"`.

## Naming

- `use` prefix: `useEntityCrud`, `useAvailableMonths`, `useAsyncFetch`
- Named export (not default): `export function useHookName()`
- Result type: `UseHookNameResult` as an explicitly typed interface

## Return Type

Return typed objects — not tuples or arrays:

```ts
// Preferred — named object properties
interface UseAsyncFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}
export function useAsyncFetch<T>(url: string): UseAsyncFetchResult<T> { ... }

// Avoided — unnamed tuple
return [data, loading, error];
```

## Cancelled Flag Pattern

Every hook with async operations must use a `cancelled` flag for cleanup:

```ts
useEffect(() => {
  let cancelled = false;
  async function load() {
    const res = await fetch(url);
    const json = await res.json();
    if (!cancelled) setData(json);
  }
  load();
  return () => { cancelled = true; };
}, [url]);
```

## Options Pattern

For complex hooks, accept an options object with generics:

```ts
interface UseEntityCrudOptions<T> {
  apiUrl: string;
  schema: ZodSchema;
  transform?: (item: T) => T;
}
export function useEntityCrud<T>(options: UseEntityCrudOptions<T>) { ... }
```

## Rules

- `"use client"` directive at the top
- Hooks do NOT call other custom hooks (flat composition)
- No SWR or React Query — use `useState` + `useEffect`
- `@/` path alias for all imports
