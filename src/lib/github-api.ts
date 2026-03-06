import { ApiMode } from "@/entities/enums";

export interface GitHubSeatAssignee {
  login: string;
  id: number;
  avatar_url: string;
  type: string;
}

export interface GitHubSeatAssignment {
  created_at: string;
  updated_at: string;
  pending_cancellation_date: string | null;
  last_activity_at: string | null;
  last_activity_editor: string | null;
  plan_type: string;
  assignee: GitHubSeatAssignee;
}

export interface GitHubSeatsResponse {
  total_seats: number;
  seats: GitHubSeatAssignment[];
}

export interface GitHubUsageItem {
  product: string;
  sku: string;
  model: string;
  unitType: string;
  pricePerUnit: number;
  grossQuantity: number;
  grossAmount: number;
  discountQuantity: number;
  discountAmount: number;
  netQuantity: number;
  netAmount: number;
}

export interface GitHubUsageResponse {
  timePeriod: { year: number; month: number; day: number };
  user: string;
  organization: string;
  usageItems: GitHubUsageItem[];
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

const GITHUB_API_BASE = "https://api.github.com";
const PER_PAGE = 100;
const RATE_LIMIT_WARNING_THRESHOLD = 100;

function logRateLimitInfo(response: Response, url: string): void {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");

  if (remaining === null && reset === null) {
    return;
  }

  const remainingNum = remaining !== null ? Number(remaining) : null;
  const resetDate =
    reset !== null && !Number.isNaN(Number(reset))
      ? new Date(Number(reset) * 1000).toISOString()
      : null;

  const endpoint = url.replace(GITHUB_API_BASE, "");

  const remainingDisplay =
    remainingNum !== null && !Number.isNaN(remainingNum)
      ? remainingNum
      : "unknown";

  console.log(
    `GitHub API rate limit: ${remainingDisplay} requests remaining, ` +
      `resets at ${resetDate ?? "unknown"} [${endpoint}]`,
  );

  if (
    remainingNum !== null &&
    !Number.isNaN(remainingNum) &&
    remainingNum < RATE_LIMIT_WARNING_THRESHOLD
  ) {
    console.warn(
      `GitHub API rate limit LOW: only ${remainingNum} requests remaining, ` +
        `resets at ${resetDate ?? "unknown"} [${endpoint}]`,
    );
  }
}

function buildSeatsUrl(apiMode: ApiMode, entityName: string): string {
  if (apiMode === ApiMode.ORGANISATION) {
    return `${GITHUB_API_BASE}/orgs/${encodeURIComponent(entityName)}/copilot/billing/seats`;
  }
  return `${GITHUB_API_BASE}/enterprises/${encodeURIComponent(entityName)}/copilot/billing/seats`;
}

function buildUsageUrl(apiMode: ApiMode, entityName: string): string {
  if (apiMode === ApiMode.ORGANISATION) {
    return `${GITHUB_API_BASE}/organizations/${encodeURIComponent(entityName)}/settings/billing/premium_request/usage`;
  }
  return `${GITHUB_API_BASE}/enterprises/${encodeURIComponent(entityName)}/settings/billing/premium_request/usage`;
}

export async function fetchAllCopilotSeats(
  config: { apiMode: ApiMode; entityName: string },
  token: string,
): Promise<GitHubSeatAssignment[]> {
  const baseUrl = buildSeatsUrl(config.apiMode, config.entityName);
  const allSeats: GitHubSeatAssignment[] = [];
  let page = 1;

  while (true) {
    const url = `${baseUrl}?page=${page}&per_page=${PER_PAGE}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    logRateLimitInfo(response, url);

    if (!response.ok) {
      const body = await response.text();
      throw new GitHubApiError(
        `GitHub API returned ${response.status}: ${response.statusText}`,
        response.status,
        body
      );
    }

    const data: GitHubSeatsResponse = await response.json();
    allSeats.push(...data.seats);

    if (data.seats.length < PER_PAGE) {
      break;
    }

    page++;
  }

  return allSeats;
}

export async function fetchPremiumRequestUsage(
  config: {
    apiMode: ApiMode;
    entityName: string;
    username: string;
    day: number;
    month: number;
    year: number;
  },
  token: string,
): Promise<GitHubUsageResponse> {
  const params = new URLSearchParams({
    user: config.username,
    day: String(config.day),
    month: String(config.month),
    year: String(config.year),
  });
  const url = `${buildUsageUrl(config.apiMode, config.entityName)}?${params}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  logRateLimitInfo(response, url);

  if (!response.ok) {
    const body = await response.text();
    throw new GitHubApiError(
      `GitHub API returned ${response.status}: ${response.statusText}`,
      response.status,
      body
    );
  }

  return response.json();
}
