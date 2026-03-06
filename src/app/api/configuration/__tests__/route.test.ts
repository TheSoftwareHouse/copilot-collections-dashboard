/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { ApiMode } from "@/entities/enums";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";

// We need to mock the `getDb` function to return our test data source
// instead of the app's data source.
let testDs: DataSource;

// Mock getDb before importing the route handlers
vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

// Mock next/headers cookies for auth
let mockCookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieStore[name];
      return value !== undefined ? { value } : undefined;
    },
  }),
}));

// Import route handlers AFTER setting up the mock
const { GET, POST, PUT } = await import("@/app/api/configuration/route");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);

async function seedAuthSession(options?: { role?: string }): Promise<void> {
  const { UserEntity } = await import("@/entities/user.entity");
  const { UserRole } = await import("@/entities/enums");
  const userRepo = testDs.getRepository(UserEntity);
  const user = await userRepo.save({
    username: "testadmin",
    passwordHash: await hashPassword("testpass"),
    role: options?.role ?? UserRole.ADMIN,
  });
  const token = await createSession(user.id);
  mockCookieStore[SESSION_COOKIE_NAME] = token;
}

function makeRequest(
  method: string,
  body?: Record<string, unknown>
): Request {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost:3000/api/configuration", init);
}

describe("GET /api/configuration", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockCookieStore = {};
    await seedAuthSession();
  });

  it("returns 401 when no session is provided", async () => {
    mockCookieStore = {};
    const response = await GET();
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Authentication required");
  });

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await cleanDatabase(testDs);
    mockCookieStore = {};
    await seedAuthSession({ role: UserRole.USER });
    const response = await GET();
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("returns 404 when no configuration exists", async () => {
    const response = await GET();
    expect(response.status).toBe(404);

    const json = await response.json();
    expect(json.error).toBe("Configuration not found");
  });

  it("returns 200 with configuration data when config exists", async () => {
    // Seed a configuration
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "TestOrg",
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.apiMode).toBe("organisation");
    expect(json.entityName).toBe("TestOrg");
    expect(json.createdAt).toBeDefined();
    expect(json.updatedAt).toBeDefined();
  });

  it("returns premiumRequestsPerSeat with default value (300)", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "TestOrg",
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.premiumRequestsPerSeat).toBe(300);
  });
});

describe("POST /api/configuration", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockCookieStore = {};
  });

  it("returns 201 and creates configuration with valid input", async () => {
    const request = makeRequest("POST", {
      apiMode: "organisation",
      entityName: "TheSoftwareHouse",
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json.apiMode).toBe("organisation");
    expect(json.entityName).toBe("TheSoftwareHouse");
    expect(json.createdAt).toBeDefined();
    expect(json.updatedAt).toBeDefined();
  });

  it("returns 400 for invalid apiMode", async () => {
    const request = makeRequest("POST", {
      apiMode: "invalid",
      entityName: "TestOrg",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details.apiMode).toBeDefined();
  });

  it("returns 400 for empty entityName", async () => {
    const request = makeRequest("POST", {
      apiMode: "organisation",
      entityName: "",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details.entityName).toBeDefined();
  });

  it("returns 400 for missing body fields", async () => {
    const request = makeRequest("POST", {});

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 409 when configuration already exists", async () => {
    // Create initial configuration
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "ExistingOrg",
    });

    // Attempt to create another
    const request = makeRequest("POST", {
      apiMode: "enterprise",
      entityName: "AnotherOrg",
    });

    const response = await POST(request);
    expect(response.status).toBe(409);

    const json = await response.json();
    expect(json.error).toBe("Configuration already exists");
  });

  it("persists configuration to the database", async () => {
    const request = makeRequest("POST", {
      apiMode: "enterprise",
      entityName: "AcmeCorp",
    });

    await POST(request);

    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    const saved = await repo.findOne({ where: {} });

    expect(saved).not.toBeNull();
    expect(saved!.apiMode).toBe("enterprise");
    expect(saved!.entityName).toBe("AcmeCorp");
  });

  it("creates configuration with custom premiumRequestsPerSeat", async () => {
    const request = makeRequest("POST", {
      apiMode: "organisation",
      entityName: "TestOrg",
      premiumRequestsPerSeat: 500,
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json.premiumRequestsPerSeat).toBe(500);
  });

  it("creates configuration with default premiumRequestsPerSeat when not provided", async () => {
    const request = makeRequest("POST", {
      apiMode: "organisation",
      entityName: "TestOrg",
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json.premiumRequestsPerSeat).toBe(300);
  });
});

describe("PUT /api/configuration", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockCookieStore = {};
    await seedAuthSession();
  });

  it("returns 401 when no session is provided", async () => {
    mockCookieStore = {};
    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: 500,
    });
    const response = await PUT(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Authentication required");
  });

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await cleanDatabase(testDs);
    mockCookieStore = {};
    await seedAuthSession({ role: UserRole.USER });
    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: 500,
    });
    const response = await PUT(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("returns 200 and updates configuration with valid input", async () => {
    // Seed existing configuration
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "OriginalOrg",
      premiumRequestsPerSeat: 300,
    });

    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: 500,
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.premiumRequestsPerSeat).toBe(500);
    expect(json.apiMode).toBe("organisation");
    expect(json.entityName).toBe("OriginalOrg");
    expect(json.createdAt).toBeDefined();
    expect(json.updatedAt).toBeDefined();
  });

  it("returns updated updatedAt value after update", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    const original = await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "OriginalOrg",
    });
    const originalUpdatedAt = original.updatedAt;

    // Small delay to ensure timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 50));

    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: 500,
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(new Date(json.updatedAt).getTime()).toBeGreaterThan(
      new Date(originalUpdatedAt).getTime()
    );
  });

  it("returns 404 when no configuration exists", async () => {
    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: 500,
    });

    const response = await PUT(request);
    expect(response.status).toBe(404);

    const json = await response.json();
    expect(json.error).toBe("Configuration not found");
  });

  it("returns 400 for malformed JSON body", async () => {
    const request = new Request("http://localhost:3000/api/configuration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  it("persists updated values to the database", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "OriginalOrg",
      premiumRequestsPerSeat: 300,
    });

    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: 500,
    });

    await PUT(request);

    const saved = await repo.findOne({ where: {} });
    expect(saved).not.toBeNull();
    expect(saved!.premiumRequestsPerSeat).toBe(500);
    expect(saved!.apiMode).toBe("organisation");
    expect(saved!.entityName).toBe("OriginalOrg");
  });

  it("updates premiumRequestsPerSeat", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "TestOrg",
      premiumRequestsPerSeat: 300,
    });

    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: 500,
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.premiumRequestsPerSeat).toBe(500);
  });

  it("returns 400 for invalid premiumRequestsPerSeat (negative)", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "TestOrg",
    });

    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: -1,
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details.premiumRequestsPerSeat).toBeDefined();
  });

  it("returns 400 for invalid premiumRequestsPerSeat (zero)", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "TestOrg",
    });

    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: 0,
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for non-integer premiumRequestsPerSeat", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "TestOrg",
    });

    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: 1.5,
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when premiumRequestsPerSeat is missing", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "TestOrg",
    });

    const request = makeRequest("PUT", {});

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for non-numeric premiumRequestsPerSeat", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "TestOrg",
    });

    const request = makeRequest("PUT", {
      premiumRequestsPerSeat: "abc",
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });
});
