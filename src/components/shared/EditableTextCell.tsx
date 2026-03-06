"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface EditableTextCellProps {
  value: string | null;
  onSave: (newValue: string | null) => Promise<void>;
  ariaLabel: string;
}

export default function EditableTextCell({
  value,
  onSave,
  ariaLabel,
}: EditableTextCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function activate() {
    if (isSaving) return;
    setEditValue(value ?? "");
    setIsEditing(true);
  }

  const save = useCallback(async () => {
    if (savingRef.current) return;

    const trimmed = editValue.trim();
    const newValue = trimmed === "" ? null : trimmed;

    // If value hasn't changed, just close
    if (newValue === (value ?? null)) {
      setIsEditing(false);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      await onSave(newValue);
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
  }, [editValue, value, onSave]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
    }
  }

  function handleBlur() {
    if (savingRef.current) return;
    save();
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
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        aria-label={ariaLabel}
        autoComplete="off"
        className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
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
      {value ?? "—"}
    </span>
  );
}
