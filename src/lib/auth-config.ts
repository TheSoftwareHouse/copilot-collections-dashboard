import { z } from "zod";

export const SUPPORTED_AUTH_METHODS = ["credentials", "azure"] as const;

export type AuthMethod = (typeof SUPPORTED_AUTH_METHODS)[number];

export type AuthConfig =
  | { method: "credentials" }
  | {
      method: "azure";
      tenantId: string;
      clientId: string;
      redirectUri: string;
    };

const authMethodSchema = z
  .string()
  .optional()
  .transform((val) => (val === "" || val === undefined ? "credentials" : val))
  .pipe(
    z.enum(SUPPORTED_AUTH_METHODS, {
      error: `AUTH_METHOD must be one of: ${SUPPORTED_AUTH_METHODS.join(", ")}`,
    }),
  );

const azureConfigSchema = z.object({
  tenantId: z
    .string({ error: "AZURE_TENANT_ID is required when AUTH_METHOD=azure" })
    .min(1, "AZURE_TENANT_ID is required when AUTH_METHOD=azure"),
  clientId: z
    .string({ error: "AZURE_CLIENT_ID is required when AUTH_METHOD=azure" })
    .min(1, "AZURE_CLIENT_ID is required when AUTH_METHOD=azure"),
  redirectUri: z
    .string({
      error: "AZURE_REDIRECT_URI is required when AUTH_METHOD=azure",
    })
    .min(1, "AZURE_REDIRECT_URI is required when AUTH_METHOD=azure")
    .url("AZURE_REDIRECT_URI must be a valid URL"),
});

let cachedConfig: AuthConfig | undefined;

/**
 * Read and validate auth configuration from environment variables.
 * Caches the result on success; throws a descriptive Error on failure.
 *
 * Must be called once at startup (e.g. in `instrumentation.ts`).
 */
export function validateAuthConfig(): AuthConfig {
  const methodResult = authMethodSchema.safeParse(process.env.AUTH_METHOD);

  if (!methodResult.success) {
    throw new Error(
      `Invalid auth configuration: ${methodResult.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  const method = methodResult.data;

  if (method === "credentials") {
    cachedConfig = { method: "credentials" };
    return cachedConfig;
  }

  // method === "azure" — validate required Azure variables
  const azureResult = azureConfigSchema.safeParse({
    tenantId: process.env.AZURE_TENANT_ID || undefined,
    clientId: process.env.AZURE_CLIENT_ID || undefined,
    redirectUri: process.env.AZURE_REDIRECT_URI || undefined,
  });

  if (!azureResult.success) {
    const messages = azureResult.error.issues.map((i) => i.message);
    throw new Error(
      `Invalid auth configuration: ${messages.join("; ")}`,
    );
  }

  cachedConfig = {
    method: "azure",
    tenantId: azureResult.data.tenantId,
    clientId: azureResult.data.clientId,
    redirectUri: azureResult.data.redirectUri,
  };

  return cachedConfig;
}

/**
 * Return the validated auth configuration.
 * Lazily initialises from environment variables if `validateAuthConfig()` has
 * not been called yet (e.g. Next.js dev-mode module isolation between
 * instrumentation and page rendering contexts).
 */
export function getAuthConfig(): AuthConfig {
  if (!cachedConfig) {
    return validateAuthConfig();
  }
  return cachedConfig;
}

/**
 * Convenience helper — returns the active authentication method.
 */
export function getAuthMethod(): AuthMethod {
  return getAuthConfig().method;
}

/**
 * Determine whether cookies should use the `Secure` flag.
 *
 * When Azure auth is configured we derive the flag from the protocol of
 * `AZURE_REDIRECT_URI` — this avoids the common pitfall where
 * `NODE_ENV=production` (set by Docker) enables `Secure` cookies while the
 * app is served over plain HTTP (e.g. `http://localhost:3000`).
 *
 * For credentials-based auth we fall back to the traditional NODE_ENV check.
 */
export function shouldUseSecureCookies(): boolean {
  const config = getAuthConfig();
  if (config.method === "azure") {
    return config.redirectUri.startsWith("https://");
  }
  return process.env.NODE_ENV === "production";
}
