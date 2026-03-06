import { NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getAuthMethod, shouldUseSecureCookies } from "@/lib/auth-config";

export async function POST() {
  try {
    await destroySession();

    const responseBody: { success: boolean; azureLogoutUrl?: string } = {
      success: true,
    };

    if (getAuthMethod() === "azure") {
      try {
        const { getAzureLogoutUrl } = await import("@/lib/azure-auth");
        responseBody.azureLogoutUrl = getAzureLogoutUrl();
      } catch (error) {
        console.warn("Failed to generate Azure logout URL:", error);
      }
    }

    const response = NextResponse.json(responseBody);
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/logout failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
