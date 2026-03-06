import { getDb } from "@/lib/db";
import { GitHubAppEntity } from "@/entities/github-app.entity";
import { decrypt } from "@/lib/encryption";
import { generateAppJwt } from "@/lib/github-jwt";

export class NoOrgConnectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoOrgConnectedError";
  }
}

/**
 * Generate a short-lived GitHub App installation access token.
 *
 * Loads the GitHubApp entity from the database, decrypts the stored private key,
 * signs a JWT, and exchanges it for an installation access token via the GitHub API.
 *
 * Throws `NoOrgConnectedError` when no GitHub App or installation is configured,
 * allowing callers to distinguish between "not configured" (graceful skip) and
 * operational errors (job failure).
 */
export async function getInstallationToken(): Promise<string> {
  const dataSource = await getDb();
  const repo = dataSource.getRepository(GitHubAppEntity);

  const githubApp = await repo.findOne({ where: {} });
  if (!githubApp) {
    throw new NoOrgConnectedError(
      "No GitHub App configured. Complete the GitHub App setup to enable API access.",
    );
  }

  if (githubApp.installationId === null) {
    throw new NoOrgConnectedError(
      "GitHub App is not installed on any organisation. Complete the installation flow to enable API access.",
    );
  }

  const privateKeyPem = decrypt(githubApp.privateKeyEncrypted);
  const jwt = generateAppJwt(githubApp.appId, privateKeyPem);

  const url = `https://api.github.com/app/installations/${encodeURIComponent(String(githubApp.installationId))}/access_tokens`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create installation access token: GitHub API returned ${response.status}`,
    );
  }

  const data = await response.json();
  if (typeof data.token !== "string") {
    throw new Error("Unexpected response from GitHub: missing token field");
  }
  return data.token;
}
