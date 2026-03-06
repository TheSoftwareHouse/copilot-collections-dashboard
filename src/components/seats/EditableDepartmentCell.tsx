"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface DepartmentOption {
  id: number;
  name: string;
}

interface EditableDepartmentCellProps {
  departmentId: number | null;
  departmentName: string | null;
  departments: DepartmentOption[];
  onSave: (departmentId: number | null) => Promise<void>;
  ariaLabel?: string;
}

export default function EditableDepartmentCell({
  departmentId,
  departmentName,
  departments,
  onSave,
  ariaLabel = "Edit department",
}: EditableDepartmentCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  function activate() {
    if (isSaving) return;
    setIsEditing(true);
  }

  const save = useCallback(
    async (newDepartmentId: number | null) => {
      if (savingRef.current) return;

      // If value hasn't changed, just close
      if (newDepartmentId === departmentId) {
        setIsEditing(false);
        return;
      }

      savingRef.current = true;
      setIsSaving(true);
      try {
        await onSave(newDepartmentId);
        setIsEditing(false);
      } catch {
        // Revert on error — close edit mode and briefly flash red
        setIsEditing(false);
        setHasError(true);
        setTimeout(() => setHasError(false), 2000);
      } finally {
        setIsSaving(false);
        savingRef.current = false;
      }
    },
    [departmentId, onSave],
  );

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const newId = val === "" ? null : Number(val);
    save(newId);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLSelectElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
    }
  }

  function handleBlur() {
    if (savingRef.current) return;
    setIsEditing(false);
  }

  function handleStaticKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  }

  if (isSaving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
        <svg
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Saving…
      </span>
    );
  }

  if (isEditing) {
    return (
      <select
        ref={selectRef}
        value={departmentId ?? ""}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        aria-label={ariaLabel}
        className="w-full rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">— None —</option>
        {departments.map((dept) => (
          <option key={dept.id} value={dept.id}>
            {dept.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={handleStaticKeyDown}
      aria-label={ariaLabel}
      className={`cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-gray-100 ${hasError ? "text-red-600 ring-1 ring-red-300" : "text-gray-700"}`}
    >
      {departmentName ?? "—"}
    </span>
  );
}
