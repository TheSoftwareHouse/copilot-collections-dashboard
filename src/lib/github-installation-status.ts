import { generateAppJwt } from "@/lib/github-jwt";

export type ConnectionStatus =
  | "active"
  | "suspended"
  | "revoked"
  | "unknown";

export interface InstallationStatusResult {
  status: ConnectionStatus;
  suspendedAt?: string;
  statusMessage?: string;
}

export async function checkInstallationStatus(
  appId: number,
  privateKeyPem: string,
  installationId: number,
): Promise<InstallationStatusResult> {
  try {
    const jwt = generateAppJwt(appId, privateKeyPem);

    const url = `https://api.github.com/app/installations/${encodeURIComponent(String(installationId))}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (response.status === 404) {
      return {
        status: "revoked",
        statusMessage:
          "The GitHub App installation has been removed. Reconnect via the organisation settings.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: "unknown",
        statusMessage:
          "Unable to verify connection — GitHub App credentials may be invalid.",
      };
    }

    if (!response.ok) {
      return {
        status: "unknown",
        statusMessage: "Unable to verify connection status with GitHub.",
      };
    }

    const data = await response.json();

    if (data.suspended_at) {
      return {
        status: "suspended",
        suspendedAt: data.suspended_at,
        statusMessage:
          "The GitHub App installation has been suspended. Re-enable it from your organisation's GitHub App settings.",
      };
    }

    return { status: "active" };
  } catch {
    return {
      status: "unknown",
      statusMessage: "Unable to verify connection status with GitHub.",
    };
  }
}
