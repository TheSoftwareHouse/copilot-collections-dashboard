import { redirect } from "next/navigation";
import { getSession, seedDefaultAdmin } from "@/lib/auth";
import { getAuthMethod } from "@/lib/auth-config";
import LoginForm from "@/components/auth/LoginForm";
import AzureLoginButton from "@/components/auth/AzureLoginButton";

export const metadata = {
  title: "Sign In — Copilot Dashboard",
};

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Authentication failed or was cancelled. Please try again.",
  provider_unavailable:
    "The identity provider is currently unavailable. Please try again later.",
  token_exchange_failed:
    "Authentication could not be completed. Please try again.",
  state_mismatch: "Security validation failed. Please try again.",
  invalid_callback:
    "Invalid response from identity provider. Please try again.",
};

const DEFAULT_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Redirect authenticated users to dashboard
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const authMethod = getAuthMethod();

  // Seed default admin only in credentials mode — Azure mode delegates user
  // management to Azure AD, so a local admin account is unnecessary.
  if (authMethod === "credentials") {
    await seedDefaultAdmin();
  }
  const params = await searchParams;
  const errorCode =
    typeof params.error === "string" ? params.error : undefined;
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] || DEFAULT_ERROR_MESSAGE
    : undefined;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Sign in to Copilot Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {authMethod === "azure"
              ? "Sign in with your organization's Azure account."
              : "Enter your credentials to access the dashboard."}
          </p>
        </div>
        {errorMessage && (
          <div
            role="alert"
            className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
          >
            {errorMessage}
          </div>
        )}
        {authMethod === "azure" ? <AzureLoginButton /> : <LoginForm />}
      </div>
    </main>
  );
}
