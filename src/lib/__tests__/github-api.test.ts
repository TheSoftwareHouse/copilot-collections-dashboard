import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiMode } from "@/entities/enums";
import {
  fetchAllCopilotSeats,
  fetchPremiumRequestUsage,
  GitHubApiError,
  type GitHubSeatsResponse,
  type GitHubUsageResponse,
} from "@/lib/github-api";

const TEST_TOKEN = "ghp_test_token_123";

function makeSeatsResponse(
  count: number,
  totalSeats: number,
  startId = 1
): GitHubSeatsResponse {
  return {
    total_seats: totalSeats,
    seats: Array.from({ length: count }, (_, i) => ({
      created_at: "2021-08-03T18:00:00-06:00",
      updated_at: "2021-09-23T15:00:00-06:00",
      pending_cancellation_date: null,
      last_activity_at: "2021-10-14T00:53:32-06:00",
      last_activity_editor: "vscode/1.77.3/copilot/1.86.82",
      plan_type: "business",
      assignee: {
        login: `user-${startId + i}`,
        id: startId + i,
        avatar_url: `https://github.com/images/user-${startId + i}.gif`,
        type: "User",
      },
    })),
  };
}

describe("fetchAllCopilotSeats", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches single page of seats for organisation mode with correct URL and headers", async () => {
    const mockResponse = makeSeatsResponse(3, 3);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const seats = await fetchAllCopilotSeats({
      apiMode: ApiMode.ORGANISATION,
      entityName: "my-org",
    }, TEST_TOKEN);

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/orgs/my-org/copilot/billing/seats?page=1&per_page=100",
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${TEST_TOKEN}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    expect(seats).toHaveLength(3);
    expect(seats[0].assignee.login).toBe("user-1");
  });

  it("fetches single page of seats for enterprise mode with correct URL", async () => {
    const mockResponse = makeSeatsResponse(2, 2);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const seats = await fetchAllCopilotSeats({
      apiMode: ApiMode.ENTERPRISE,
      entityName: "my-enterprise",
    }, TEST_TOKEN);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/enterprises/my-enterprise/copilot/billing/seats?page=1&per_page=100",
      expect.any(Object)
    );
    expect(seats).toHaveLength(2);
  });

  it("handles multi-page pagination", async () => {
    const page1 = makeSeatsResponse(100, 150, 1);
    const page2 = makeSeatsResponse(50, 150, 101);

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page1), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page2), { status: 200 })
      );

    const seats = await fetchAllCopilotSeats({
      apiMode: ApiMode.ORGANISATION,
      entityName: "big-org",
    }, TEST_TOKEN);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("page=1"),
      expect.any(Object)
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("page=2"),
      expect.any(Object)
    );
    expect(seats).toHaveLength(150);
    expect(seats[0].assignee.login).toBe("user-1");
    expect(seats[149].assignee.login).toBe("user-150");
  });

  it("throws GitHubApiError for 401 Unauthorized", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Bad credentials" }), {
        status: 401,
        statusText: "Unauthorized",
      })
    );

    try {
      await fetchAllCopilotSeats({
        apiMode: ApiMode.ORGANISATION,
        entityName: "my-org",
      }, TEST_TOKEN);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubApiError);
      expect((error as GitHubApiError).statusCode).toBe(401);
      expect((error as GitHubApiError).responseBody).toContain(
        "Bad credentials"
      );
    }
  });

  it("throws GitHubApiError for 503 Service Unavailable", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Service Unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      })
    );

    await expect(
      fetchAllCopilotSeats({
        apiMode: ApiMode.ENTERPRISE,
        entityName: "my-ent",
      }, TEST_TOKEN)
    ).rejects.toThrow(GitHubApiError);
  });

  it("returns empty array when API returns zero seats", async () => {
    const emptyResponse: GitHubSeatsResponse = { total_seats: 0, seats: [] };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(emptyResponse), { status: 200 })
    );

    const seats = await fetchAllCopilotSeats({
      apiMode: ApiMode.ORGANISATION,
      entityName: "empty-org",
    }, TEST_TOKEN);

    expect(seats).toEqual([]);
  });
});

describe("fetchPremiumRequestUsage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const defaultConfig = {
    apiMode: ApiMode.ORGANISATION,
    entityName: "my-org",
    username: "octocat",
    day: 15,
    month: 2,
    year: 2026,
  };

  const sampleResponse: GitHubUsageResponse = {
    timePeriod: { year: 2026, month: 2, day: 15 },
    user: "octocat",
    organization: "my-org",
    usageItems: [
      {
        product: "Copilot",
        sku: "Copilot Premium Request",
        model: "Claude Sonnet 4.5",
        unitType: "requests",
        pricePerUnit: 0.04,
        grossQuantity: 53.0,
        grossAmount: 2.12,
        discountQuantity: 53.0,
        discountAmount: 2.12,
        netQuantity: 0.0,
        netAmount: 0.0,
      },
    ],
  };

  it("fetches usage data with correct URL including query parameters", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(sampleResponse), { status: 200 })
    );

    await fetchPremiumRequestUsage(defaultConfig, TEST_TOKEN);

    expect(fetch).toHaveBeenCalledOnce();
    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain(
      "https://api.github.com/organizations/my-org/settings/billing/premium_request/usage?"
    );
    expect(calledUrl).toContain("user=octocat");
    expect(calledUrl).toContain("day=15");
    expect(calledUrl).toContain("month=2");
    expect(calledUrl).toContain("year=2026");
  });

  it("fetches usage data with enterprise URL when apiMode is enterprise", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(sampleResponse), { status: 200 })
    );

    await fetchPremiumRequestUsage({
      ...defaultConfig,
      apiMode: ApiMode.ENTERPRISE,
      entityName: "my-enterprise",
    }, TEST_TOKEN);

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain(
      "https://api.github.com/enterprises/my-enterprise/settings/billing/premium_request/usage?"
    );
    expect(calledUrl).toContain("user=octocat");
  });

  it("sends correct authorization headers", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(sampleResponse), { status: 200 })
    );

    await fetchPremiumRequestUsage(defaultConfig, TEST_TOKEN);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${TEST_TOKEN}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
  });

  it("returns parsed GitHubUsageResponse with all fields", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(sampleResponse), { status: 200 })
    );

    const result = await fetchPremiumRequestUsage(defaultConfig, TEST_TOKEN);

    expect(result.timePeriod).toEqual({ year: 2026, month: 2, day: 15 });
    expect(result.user).toBe("octocat");
    expect(result.organization).toBe("my-org");
    expect(result.usageItems).toHaveLength(1);
    expect(result.usageItems[0].model).toBe("Claude Sonnet 4.5");
    expect(result.usageItems[0].pricePerUnit).toBe(0.04);
    expect(result.usageItems[0].grossAmount).toBe(2.12);
  });

  it("handles response with empty usageItems array", async () => {
    const emptyUsageResponse: GitHubUsageResponse = {
      ...sampleResponse,
      usageItems: [],
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(emptyUsageResponse), { status: 200 })
    );

    const result = await fetchPremiumRequestUsage(defaultConfig, TEST_TOKEN);

    expect(result.usageItems).toEqual([]);
  });

  it("throws GitHubApiError for 404 Not Found", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        statusText: "Not Found",
      })
    );

    try {
      await fetchPremiumRequestUsage(defaultConfig, TEST_TOKEN);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubApiError);
      expect((error as GitHubApiError).statusCode).toBe(404);
      expect((error as GitHubApiError).responseBody).toContain("Not Found");
    }
  });

  it("throws GitHubApiError for 503 Service Unavailable", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Service Unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      })
    );

    await expect(
      fetchPremiumRequestUsage(defaultConfig, TEST_TOKEN)
    ).rejects.toThrow(GitHubApiError);
  });

  it("encodes entity name in URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(sampleResponse), { status: 200 })
    );

    await fetchPremiumRequestUsage({
      ...defaultConfig,
      entityName: "my org/special",
    }, TEST_TOKEN);

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("organizations/my%20org%2Fspecial/");
  });
});

describe("rate limit header logging", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const seatsConfig = {
    apiMode: ApiMode.ORGANISATION as const,
    entityName: "my-org",
  };

  const usageConfig = {
    apiMode: ApiMode.ORGANISATION,
    entityName: "my-org",
    username: "octocat",
    day: 15,
    month: 2,
    year: 2026,
  };

  const sampleUsageResponse: GitHubUsageResponse = {
    timePeriod: { year: 2026, month: 2, day: 15 },
    user: "octocat",
    organization: "my-org",
    usageItems: [],
  };

  function makeResponseWithRateLimitHeaders(
    body: unknown,
    status: number,
    remaining: string,
    reset: string,
  ): Response {
    return new Response(JSON.stringify(body), {
      status,
      statusText: status === 200 ? "OK" : "Forbidden",
      headers: {
        "x-ratelimit-remaining": remaining,
        "x-ratelimit-reset": reset,
      },
    });
  }

  it("fetchAllCopilotSeats logs rate limit info from response headers on success", async () => {
    const resetTimestamp = "1740700800"; // 2025-02-28T00:00:00Z
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponseWithRateLimitHeaders(
        makeSeatsResponse(2, 2),
        200,
        "4500",
        resetTimestamp,
      ),
    );

    await fetchAllCopilotSeats(seatsConfig, TEST_TOKEN);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("4500 requests remaining"),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("2025-02-28T00:00:00.000Z"),
    );
  });

  it("fetchAllCopilotSeats logs rate limit info on each page of a multi-page response", async () => {
    const page1 = makeSeatsResponse(100, 150, 1);
    const page2 = makeSeatsResponse(50, 150, 101);

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeResponseWithRateLimitHeaders(page1, 200, "4800", "1740700800"),
      )
      .mockResolvedValueOnce(
        makeResponseWithRateLimitHeaders(page2, 200, "4799", "1740700800"),
      );

    await fetchAllCopilotSeats(seatsConfig, TEST_TOKEN);

    const logCalls = vi.mocked(console.log).mock.calls
      .map((c) => c[0] as string)
      .filter((msg) => msg.includes("rate limit"));

    expect(logCalls).toHaveLength(2);
    expect(logCalls[0]).toContain("4800 requests remaining");
    expect(logCalls[1]).toContain("4799 requests remaining");
  });

  it("fetchAllCopilotSeats logs rate limit info before throwing on error response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponseWithRateLimitHeaders(
        { message: "rate limit exceeded" },
        403,
        "0",
        "1740700800",
      ),
    );

    await expect(fetchAllCopilotSeats(seatsConfig, TEST_TOKEN)).rejects.toThrow(
      GitHubApiError,
    );

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("0 requests remaining"),
    );
  });

  it("fetchPremiumRequestUsage logs rate limit info from response headers on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponseWithRateLimitHeaders(
        sampleUsageResponse,
        200,
        "3200",
        "1740700800",
      ),
    );

    await fetchPremiumRequestUsage(usageConfig, TEST_TOKEN);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("3200 requests remaining"),
    );
  });

  it("fetchPremiumRequestUsage logs rate limit info before throwing on error response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponseWithRateLimitHeaders(
        { message: "Not Found" },
        404,
        "4000",
        "1740700800",
      ),
    );

    await expect(fetchPremiumRequestUsage(usageConfig, TEST_TOKEN)).rejects.toThrow(
      GitHubApiError,
    );

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("4000 requests remaining"),
    );
  });

  it("emits console.warn when x-ratelimit-remaining is below warning threshold", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponseWithRateLimitHeaders(
        sampleUsageResponse,
        200,
        "42",
        "1740700800",
      ),
    );

    await fetchPremiumRequestUsage(usageConfig, TEST_TOKEN);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("rate limit LOW"),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("42 requests remaining"),
    );
  });

  it("does not emit console.warn when x-ratelimit-remaining is at or above threshold", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponseWithRateLimitHeaders(
        sampleUsageResponse,
        200,
        "100",
        "1740700800",
      ),
    );

    await fetchPremiumRequestUsage(usageConfig, TEST_TOKEN);

    expect(console.warn).not.toHaveBeenCalled();
  });

  it("handles missing rate limit headers gracefully without logging", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(sampleUsageResponse), { status: 200 }),
    );

    await fetchPremiumRequestUsage(usageConfig, TEST_TOKEN);

    const rateLimitLogs = vi.mocked(console.log).mock.calls
      .map((c) => c[0] as string)
      .filter((msg) => msg.includes("rate limit"));

    expect(rateLimitLogs).toHaveLength(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("handles non-numeric rate limit header values gracefully", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(sampleUsageResponse), {
        status: 200,
        headers: {
          "x-ratelimit-remaining": "not-a-number",
          "x-ratelimit-reset": "invalid",
        },
      }),
    );

    await fetchPremiumRequestUsage(usageConfig, TEST_TOKEN);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("unknown requests remaining"),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("resets at unknown"),
    );
    expect(console.warn).not.toHaveBeenCalled();
  });
});
