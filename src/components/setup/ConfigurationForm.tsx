"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  configurationSchema,
  updateConfigurationSchema,
  type ConfigurationInput,
} from "@/lib/validations/configuration";

type FieldErrors = Partial<Record<keyof ConfigurationInput, string[]>>;

interface ConfigurationFormProps {
  mode?: "create" | "edit";
  initialValues?: {
    apiMode?: string;
    entityName?: string;
    premiumRequestsPerSeat?: number;
  };
}

export default function ConfigurationForm({
  mode = "create",
  initialValues,
}: ConfigurationFormProps) {
  const router = useRouter();
  const [apiMode, setApiMode] = useState<string>(
    initialValues?.apiMode ?? "organisation"
  );
  const [entityName, setEntityName] = useState(
    initialValues?.entityName ?? ""
  );
  const [premiumRequestsPerSeat, setPremiumRequestsPerSeat] = useState<string>(
    String(initialValues?.premiumRequestsPerSeat ?? 300)
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const entityLabel =
    apiMode === "enterprise" ? "Enterprise name" : "Organisation name";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);
    setSuccessMessage(null);

    // Client-side validation
    if (mode === "edit") {
      const parsedValue = parseInt(premiumRequestsPerSeat, 10);
      const payload = {
        premiumRequestsPerSeat: isNaN(parsedValue) ? premiumRequestsPerSeat as unknown as number : parsedValue,
      };
      const parsed = updateConfigurationSchema.safeParse(payload);
      if (!parsed.success) {
        setFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors);
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await fetch("/api/configuration", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });

        if (response.status === 200) {
          setSuccessMessage("Configuration updated successfully.");
          return;
        }

        if (response.status === 404) {
          setServerError("Configuration not found. Please complete the initial setup first.");
          return;
        }

        if (response.status === 400) {
          const data = await response.json();
          if (data.details) {
            setFieldErrors(data.details as FieldErrors);
          } else {
            setServerError(data.error || "Validation failed");
          }
          return;
        }

        setServerError("An unexpected error occurred. Please try again.");
      } catch {
        setServerError("Network error. Please check your connection and try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Create mode
    const payload: Record<string, unknown> = { apiMode, entityName };
    const parsed = configurationSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 201) {
        router.push("/dashboard");
        return;
      }

      if (response.status === 409) {
        setServerError("Configuration already exists. Redirecting…");
        setTimeout(() => router.push("/dashboard"), 1500);
        return;
      }

      if (response.status === 400) {
        const data = await response.json();
        if (data.details) {
          setFieldErrors(data.details as FieldErrors);
        } else {
          setServerError(data.error || "Validation failed");
        }
        return;
      }

      setServerError("An unexpected error occurred. Please try again.");
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md" noValidate>
      {successMessage && (
        <div
          role="status"
          className="rounded-md bg-green-50 p-4 text-sm text-green-700 border border-green-200"
        >
          {successMessage}
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
        >
          {serverError}
        </div>
      )}

      {/* API Mode Selection */}
      {mode === "create" && (
      <fieldset>
        <legend className="text-sm font-medium text-gray-900 mb-3">
          GitHub API mode
        </legend>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="apiMode"
              value="organisation"
              checked={apiMode === "organisation"}
              onChange={(e) => setApiMode(e.target.value)}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Organisation</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="apiMode"
              value="enterprise"
              checked={apiMode === "enterprise"}
              onChange={(e) => setApiMode(e.target.value)}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Enterprise</span>
          </label>
        </div>
        {fieldErrors.apiMode && (
          <p
            id="apiMode-error"
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {fieldErrors.apiMode[0]}
          </p>
        )}
      </fieldset>
      )}

      {/* Entity Name */}
      {mode === "create" && (
      <div>
        <label
          htmlFor="entityName"
          className="block text-sm font-medium text-gray-900 mb-1"
        >
          {entityLabel}
        </label>
        <input
          id="entityName"
          type="text"
          name="entityName"
          value={entityName}
          onChange={(e) => setEntityName(e.target.value)}
          placeholder={
            apiMode === "enterprise"
              ? "e.g. my-enterprise"
              : "e.g. my-organisation"
          }
          aria-describedby={fieldErrors.entityName ? "entityName-error" : undefined}
          aria-invalid={!!fieldErrors.entityName}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {fieldErrors.entityName && (
          <p
            id="entityName-error"
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {fieldErrors.entityName[0]}
          </p>
        )}
      </div>
      )}

      {/* Premium Requests Per Seat — edit mode only */}
      {mode === "edit" && (
        <div>
          <label
            htmlFor="premiumRequestsPerSeat"
            className="block text-sm font-medium text-gray-900 mb-1"
          >
            Premium requests per seat (monthly allowance)
          </label>
          <input
            id="premiumRequestsPerSeat"
            type="number"
            name="premiumRequestsPerSeat"
            value={premiumRequestsPerSeat}
            onChange={(e) => setPremiumRequestsPerSeat(e.target.value)}
            min={1}
            max={100000}
            step={1}
            aria-describedby={fieldErrors.premiumRequestsPerSeat ? "premiumRequestsPerSeat-error" : undefined}
            aria-invalid={!!fieldErrors.premiumRequestsPerSeat}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {fieldErrors.premiumRequestsPerSeat && (
            <p
              id="premiumRequestsPerSeat-error"
              className="mt-1 text-sm text-red-600"
              role="alert"
            >
              {fieldErrors.premiumRequestsPerSeat[0]}
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting
          ? "Saving…"
          : mode === "edit"
            ? "Update Configuration"
            : "Save Configuration"}
      </button>
    </form>
  );
}
