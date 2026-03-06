import { NextResponse } from "next/server";
import { getAuthConfig } from "@/lib/auth-config";
import {
  getEntraIdClient,
  generateState,
  generateCodeVerifier,
  AZURE_SCOPES,
} from "@/lib/azure-auth";
import { createPkceToken } from "@/lib/pkce-token";
import { handleRouteError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const config = getAuthConfig();
    if (config.method !== "azure") {
      return NextResponse.json(
        { error: "Azure authentication is not configured" },
        { status: 404 },
      );
    }

    const entraId = getEntraIdClient();
    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    // Pack state + codeVerifier into a signed token and pass it as the
    // OAuth `state` parameter.  Azure returns it verbatim in the callback,
    // so the server can recover both values without cookies.
    const pkceToken = createPkceToken(state, codeVerifier);

    console.log("[auth/azure] Starting OAuth flow", {
      statePrefix: state.slice(0, 8),
      pkceTokenLength: pkceToken.length,
    });

    const url = entraId.createAuthorizationURL(
      pkceToken,
      codeVerifier,
      [...AZURE_SCOPES],
    );

    return NextResponse.redirect(url.toString(), 302);
  } catch (error) {
    return handleRouteError(error, "GET /api/auth/azure");
  }
}
