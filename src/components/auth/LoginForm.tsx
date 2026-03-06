"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginSchema, type LoginInput } from "@/lib/validations/login";

type FieldErrors = Partial<Record<keyof LoginInput, string[]>>;

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);

    // Client-side validation
    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 200) {
        router.push("/dashboard");
        return;
      }

      if (response.status === 401) {
        const data = await response.json();
        setServerError(data.error || "Invalid username or password");
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
      setServerError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md" noValidate>
      {serverError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
        >
          {serverError}
        </div>
      )}

      {/* Username */}
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium text-gray-900 mb-1"
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          aria-describedby={
            fieldErrors.username ? "username-error" : undefined
          }
          aria-invalid={!!fieldErrors.username}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {fieldErrors.username && (
          <p
            id="username-error"
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {fieldErrors.username[0]}
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-900 mb-1"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          aria-describedby={
            fieldErrors.password ? "password-error" : undefined
          }
          aria-invalid={!!fieldErrors.password}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {fieldErrors.password && (
          <p
            id="password-error"
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {fieldErrors.password[0]}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
