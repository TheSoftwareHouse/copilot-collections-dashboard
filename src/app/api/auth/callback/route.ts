import { NextResponse } from "next/server";
import { getAuthConfig, shouldUseSecureCookies } from "@/lib/auth-config";
import {
  getEntraIdClient,
  decodeIdToken,
  validateIdTokenClaims,
  mapArcticError,
  mapAzureRolesToAppRole,
} from "@/lib/azure-auth";
import type { IdTokenClaims } from "@/lib/azure-auth";
import {
  createSession,
  SESSION_COOKIE_NAME,
  getSessionTimeoutSeconds,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { UserEntity } from "@/entities/user.entity";
import { verifyPkceToken } from "@/lib/pkce-token";
import { isUniqueViolation } from "@/lib/db-errors";

const AZURE_AD_USER_PASSWORD_HASH = "AZURE_AD_USER";

/**
 * Derive the external app origin from the Azure redirect URI config.
 *
 * `request.url` cannot be used because Next.js standalone builds the URL
 * from the `HOSTNAME` env var (set to `0.0.0.0` in Docker), which produces
 * an unreachable redirect target in the browser.
 */
function getAppOrigin(): string {
  const config = getAuthConfig();
  if (config.method === "azure") {
    return new URL(config.redirectUri).origin;
  }
  // Fallback – should not happen since this route is Azure-only.
  return "";
}

function loginRedirect(
  _request: Request,
  errorCode: string,
): NextResponse {
  const url = new URL("/login", getAppOrigin());
  url.searchParams.set("error", errorCode);
  return NextResponse.redirect(url.toString(), 302);
}

export async function GET(request: Request) {
  try {
    const config = getAuthConfig();
    if (config.method !== "azure") {
      return NextResponse.json(
        { error: "Azure authentication is not configured" },
        { status: 404 },
      );
    }

    const url = new URL(request.url);

    // Check if Azure returned an error
    const azureError = url.searchParams.get("error");
    if (azureError) {
      console.error(
        "[auth/callback] Azure returned error:",
        azureError,
        url.searchParams.get("error_description"),
      );
      return loginRedirect(request, "auth_failed");
    }

    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");

    if (!code) {
      console.error("[auth/callback] Missing authorization code");
      return loginRedirect(request, "invalid_callback");
    }

    if (!stateParam) {
      console.error("[auth/callback] Missing state parameter");
      return loginRedirect(request, "state_mismatch");
    }

    // Verify the signed PKCE token from the state parameter
    let codeVerifier: string;
    try {
      const pkceData = verifyPkceToken(stateParam);
      codeVerifier = pkceData.codeVerifier;
      console.log("[auth/callback] PKCE token verified successfully", {
        statePrefix: pkceData.state.slice(0, 8),
      });
    } catch (error) {
      console.error("[auth/callback] PKCE token verification failed:", error);
      return loginRedirect(request, "state_mismatch");
    }

    // Exchange code for tokens
    const entraId = getEntraIdClient();
    let tokens;
    try {
      tokens = await entraId.validateAuthorizationCode(code, codeVerifier);
      console.log("[auth/callback] Token exchange successful");
    } catch (error) {
      const errorCode = mapArcticError(error);
      console.error("[auth/callback] Token exchange failed:", error);
      return loginRedirect(request, errorCode);
    }

    // Decode and validate ID token
    const idToken = tokens.idToken();
    const claims = decodeIdToken(idToken) as IdTokenClaims;

    console.log("[auth/callback] Full ID token claims:", JSON.stringify(claims, null, 2));

    validateIdTokenClaims(claims, config);

    // Extract username
    const username = claims.preferred_username || claims.sub;
    if (!username) {
      console.error("[auth/callback] No username claim found in ID token");
      return loginRedirect(request, "auth_failed");
    }

    console.log("[auth/callback] Authenticated user:", username);
    console.log("[auth/callback] Azure App Roles from ID token:", claims.roles ?? []);

    // Map Azure roles to application role
    const appRole = mapAzureRolesToAppRole(claims.roles);

    // Extract refresh token (may be null if Azure didn't return one)
    let refreshToken: string | null = null;
    try {
      refreshToken = tokens.refreshToken();
    } catch {
      // refreshToken() throws if not present — that's OK
    }

    // Upsert user
    const dataSource = await getDb();
    const userRepo = dataSource.getRepository(UserEntity);
    let user = await userRepo.findOne({ where: { username } });

    if (!user) {
      try {
        user = await userRepo.save({
          username,
          passwordHash: AZURE_AD_USER_PASSWORD_HASH,
          role: appRole,
        });
      } catch (error: unknown) {
        // Handle race condition: another request may have created the user
        if (isUniqueViolation(error)) {
          user = await userRepo.findOne({ where: { username } });
          if (!user) {
            return loginRedirect(request, "auth_failed");
          }
          // Apply role from Azure claim to the race-condition user
          if (user.role !== appRole) {
            await userRepo.update(user.id, { role: appRole });
            user.role = appRole;
          }
        } else {
          throw error;
        }
      }
    } else {
      // Existing user — update role if it changed in Azure
      if (user.role !== appRole) {
        await userRepo.update(user.id, { role: appRole });
        user.role = appRole;
      }
    }

    // Create session with refresh token
    const token = await createSession(user.id, refreshToken);
    const maxAge = getSessionTimeoutSeconds();

    const dashboardUrl = new URL("/dashboard", getAppOrigin()).toString();

    console.log("[auth/callback] Login complete, setting session cookie and redirecting to dashboard", {
      maxAge,
      dashboardUrl,
    });

    const response = NextResponse.redirect(dashboardUrl, 302);
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return response;
  } catch (error) {
    console.error("[auth/callback] Unexpected error:", error);
    return loginRedirect(request, "auth_failed");
  }
}
