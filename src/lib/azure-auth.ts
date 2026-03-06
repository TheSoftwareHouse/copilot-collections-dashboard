import {
  MicrosoftEntraId,
  generateState,
  generateCodeVerifier,
  decodeIdToken,
  OAuth2RequestError,
  ArcticFetchError,
} from "arctic";
import { getAuthConfig } from "@/lib/auth-config";
import { UserRole } from "@/entities/enums";

export { generateState, generateCodeVerifier, decodeIdToken };

export const AZURE_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;

export type AzureAuthErrorCode =
  | "auth_failed"
  | "provider_unavailable"
  | "token_exchange_failed"
  | "state_mismatch"
  | "invalid_callback";

export interface IdTokenClaims {
  sub?: string;
  oid?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  roles?: string[];
}

let entraIdClient: MicrosoftEntraId | undefined;

/**
 * Return a lazily-initialised MicrosoftEntraId client singleton.
 * Throws if auth method is not "azure".
 */
export function getEntraIdClient(): MicrosoftEntraId {
  if (entraIdClient) {
    return entraIdClient;
  }

  const config = getAuthConfig();
  if (config.method !== "azure") {
    throw new Error(
      "Azure Entra ID client is not available: AUTH_METHOD is not 'azure'",
    );
  }

  entraIdClient = new MicrosoftEntraId(
    config.tenantId,
    config.clientId,
    null,
    config.redirectUri,
  );
  return entraIdClient;
}

/**
 * Validate essential claims from an Azure AD ID token.
 * Throws a descriptive Error if any check fails.
 */
export function validateIdTokenClaims(
  claims: IdTokenClaims,
  config: { tenantId: string; clientId: string },
): void {
  const expectedIssuer = `https://login.microsoftonline.com/${config.tenantId}/v2.0`;
  if (claims.iss !== expectedIssuer) {
    throw new Error(
      `Invalid issuer: expected "${expectedIssuer}", got "${claims.iss}"`,
    );
  }

  if (claims.aud !== config.clientId) {
    throw new Error(
      `Invalid audience: expected "${config.clientId}", got "${claims.aud}"`,
    );
  }

  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) {
    throw new Error("ID token has expired");
  }
}

/**
 * Map Arctic / unknown errors to application-specific error codes.
 */
export function mapArcticError(error: unknown): AzureAuthErrorCode {
  if (error instanceof OAuth2RequestError) {
    return "auth_failed";
  }
  if (error instanceof ArcticFetchError) {
    return "provider_unavailable";
  }
  return "auth_failed";
}

/**
 * Map the Azure ID token `roles` claim to the application's UserRole.
 * If the array contains "admin" (case-insensitive), returns ADMIN; otherwise USER.
 */
export function mapAzureRolesToAppRole(roles?: string[]): UserRole {
  if (roles?.some((r) => r.toLowerCase() === "admin")) {
    return UserRole.ADMIN;
  }
  return UserRole.USER;
}

/**
 * Attempt to refresh an Azure session using the stored refresh token.
 * Returns `true` if the session was extended, `false` if it was destroyed.
 * Never throws — all errors are caught internally.
 */
export async function refreshAzureSession(
  sessionId: number,
  refreshToken: string,
): Promise<boolean> {
  try {
    const { getDb } = await import("@/lib/db");
    const { SessionEntity } = await import("@/entities/session.entity");
    const { getSessionTimeoutSeconds } = await import("@/lib/auth");

    const entraId = getEntraIdClient();
    const tokens = await entraId.refreshAccessToken(refreshToken, []);

    const dataSource = await getDb();
    const sessionRepo = dataSource.getRepository(SessionEntity);

    const newRefreshToken = tokens.refreshToken();
    const timeoutMs = getSessionTimeoutSeconds() * 1000;

    await sessionRepo.update(sessionId, {
      expiresAt: new Date(Date.now() + timeoutMs),
      refreshToken: newRefreshToken,
    });

    return true;
  } catch (error) {
    // Refresh failed — destroy the expired session
    try {
      const { getDb } = await import("@/lib/db");
      const { SessionEntity } = await import("@/entities/session.entity");
      const dataSource = await getDb();
      const sessionRepo = dataSource.getRepository(SessionEntity);
      await sessionRepo.delete(sessionId);
    } catch {
      // Best-effort cleanup; ignore secondary errors
    }
    console.error("Azure token refresh failed:", error);
    return false;
  }
}

/**
 * Construct the Azure AD v2.0 logout endpoint URL.
 * Includes `post_logout_redirect_uri` pointing to the app's login page,
 * derived from the configured AZURE_REDIRECT_URI.
 * Throws if auth method is not "azure".
 */
export function getAzureLogoutUrl(): string {
  const config = getAuthConfig();
  if (config.method !== "azure") {
    throw new Error(
      "Azure logout URL is not available: AUTH_METHOD is not 'azure'",
    );
  }

  const redirectOrigin = new URL(config.redirectUri).origin;
  const postLogoutRedirectUri = `${redirectOrigin}/login`;

  const logoutUrl = new URL(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/logout`,
  );
  logoutUrl.searchParams.set(
    "post_logout_redirect_uri",
    postLogoutRedirectUri,
  );

  return logoutUrl.toString();
}

/**
 * Reset the singleton (for testing only).
 */
export function _resetEntraIdClient(): void {
  entraIdClient = undefined;
}
