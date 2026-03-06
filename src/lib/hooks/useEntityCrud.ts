"use client";

import { useState, useEffect, useCallback } from "react";
import type { z } from "zod";

interface EntityBase {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

type FieldErrors = Partial<Record<"name", string[]>>;

interface UseEntityCrudOptions<T extends EntityBase> {
  /** API base path, e.g. "/api/teams" */
  apiPath: string;
  /** Key in the list response, e.g. "teams" */
  listKey: string;
  /** Singular entity label for error messages, e.g. "team" */
  entityLabel: string;
  /** Zod schema for the create form (must accept { name: string }) */
  createSchema: z.ZodType<{ name: string }>;
  /** Optional callback to map raw API items to the entity type */
  mapItem?: (item: Record<string, unknown>) => T;
}

interface UseEntityCrudReturn<T extends EntityBase> {
  // List
  entities: T[];
  isLoading: boolean;
  fetchError: string | null;
  refetch: () => Promise<void>;

  // Create
  showCreateForm: boolean;
  setShowCreateForm: (show: boolean) => void;
  createName: string;
  setCreateName: (name: string) => void;
  createFieldErrors: FieldErrors;
  createServerError: string | null;
  isCreating: boolean;
  handleCreate: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  resetCreateForm: () => void;

  // Inline rename
  updateName: (id: number, newName: string) => Promise<void>;

  // Delete
  confirmDeleteId: number | null;
  setConfirmDeleteId: (id: number | null) => void;
  deleteError: string | null;
  setDeleteError: (error: string | null) => void;
  isDeleting: boolean;
  handleDelete: (id: number) => Promise<void>;
}

export function useEntityCrud<T extends EntityBase>(
  options: UseEntityCrudOptions<T>,
): UseEntityCrudReturn<T> {
  const { apiPath, listKey, entityLabel, createSchema, mapItem } = options;

  const [entities, setEntities] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createFieldErrors, setCreateFieldErrors] = useState<FieldErrors>({});
  const [createServerError, setCreateServerError] = useState<string | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEntities = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch(apiPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${entityLabel}s`);
      }
      const data = await response.json();
      const items = data[listKey] as T[];
      setEntities(mapItem ? items.map((item) => mapItem(item as unknown as Record<string, unknown>)) : items);
    } catch {
      setFetchError(`Failed to load ${entityLabel}s. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [apiPath, listKey, entityLabel, mapItem]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  function resetCreateForm() {
    setCreateName("");
    setCreateFieldErrors({});
    setCreateServerError(null);
    setShowCreateForm(false);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateFieldErrors({});
    setCreateServerError(null);

    const parsed = createSchema.safeParse({ name: createName });
    if (!parsed.success) {
      setCreateFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors);
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 201) {
        resetCreateForm();
        await fetchEntities();
        return;
      }

      if (response.status === 409) {
        const data = await response.json();
        setCreateServerError(
          data.error || `${capitalize(entityLabel)} name already exists`,
        );
        return;
      }

      if (response.status === 400) {
        const data = await response.json();
        if (data.details) {
          setCreateFieldErrors(data.details as FieldErrors);
        } else {
          setCreateServerError(data.error || "Validation failed");
        }
        return;
      }

      setCreateServerError("An unexpected error occurred. Please try again.");
    } catch {
      setCreateServerError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  const updateName = useCallback(
    async (id: number, newName: string): Promise<void> => {
      const response = await fetch(`${apiPath}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (response.status === 200) {
        const data = await response.json();
        setEntities((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, name: data.name, updatedAt: data.updatedAt }
              : e,
          ),
        );
        return;
      }

      throw new Error(`Failed to update ${entityLabel} name`);
    },
    [apiPath, entityLabel],
  );

  async function handleDelete(id: number) {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const response = await fetch(`${apiPath}/${id}`, {
        method: "DELETE",
      });

      if (response.status === 200) {
        setConfirmDeleteId(null);
        await fetchEntities();
        return;
      }

      if (response.status === 404) {
        setDeleteError(
          `${capitalize(entityLabel)} not found. It may have already been deleted.`,
        );
        setConfirmDeleteId(null);
        await fetchEntities();
        return;
      }

      setDeleteError("An unexpected error occurred. Please try again.");
      setConfirmDeleteId(null);
    } catch {
      setDeleteError(
        "Network error. Please check your connection and try again.",
      );
      setConfirmDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    entities,
    isLoading,
    fetchError,
    refetch: fetchEntities,

    showCreateForm,
    setShowCreateForm,
    createName,
    setCreateName,
    createFieldErrors,
    createServerError,
    isCreating,
    handleCreate,
    resetCreateForm,

    updateName,

    confirmDeleteId,
    setConfirmDeleteId,
    deleteError,
    setDeleteError,
    isDeleting,
    handleDelete,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
