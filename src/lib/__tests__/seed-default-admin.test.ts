/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";
import { UserEntity } from "@/entities/user.entity";
import { UserRole } from "@/entities/enums";

let testDs: DataSource;

vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock("@/lib/auth-config", () => ({
  getAuthMethod: () => "credentials",
  shouldUseSecureCookies: () => false,
  getAuthConfig: () => ({ method: "credentials" }),
}));

const { seedDefaultAdmin, hashPassword } = await import("@/lib/auth");

describe("seedDefaultAdmin", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    delete process.env.DEFAULT_ADMIN_USERNAME;
    delete process.env.DEFAULT_ADMIN_PASSWORD;
  });

  it("creates new admin with role 'admin' when database is empty", async () => {
    process.env.DEFAULT_ADMIN_USERNAME = "admin";
    process.env.DEFAULT_ADMIN_PASSWORD = "password123";

    await seedDefaultAdmin();

    const user = await testDs
      .getRepository(UserEntity)
      .findOne({ where: { username: "admin" } });

    expect(user).not.toBeNull();
    expect(user!.role).toBe(UserRole.ADMIN);
    expect(user!.username).toBe("admin");
  });

  it("updates existing admin to 'admin' role if it has 'user' role", async () => {
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save({
      username: "admin",
      passwordHash: await hashPassword("pwd"),
      role: UserRole.USER,
    });

    process.env.DEFAULT_ADMIN_USERNAME = "admin";
    process.env.DEFAULT_ADMIN_PASSWORD = "password123";

    await seedDefaultAdmin();

    const user = await userRepo.findOne({ where: { username: "admin" } });

    expect(user).not.toBeNull();
    expect(user!.role).toBe(UserRole.ADMIN);
  });

  it("does not modify admin that already has 'admin' role", async () => {
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save({
      username: "admin",
      passwordHash: await hashPassword("pwd"),
      role: UserRole.ADMIN,
    });

    process.env.DEFAULT_ADMIN_USERNAME = "admin";
    process.env.DEFAULT_ADMIN_PASSWORD = "password123";

    await seedDefaultAdmin();

    const user = await userRepo.findOne({ where: { username: "admin" } });

    expect(user).not.toBeNull();
    expect(user!.role).toBe(UserRole.ADMIN);
  });

  it("does not create any users when env vars are not set", async () => {
    await seedDefaultAdmin();

    const count = await testDs.getRepository(UserEntity).count();

    expect(count).toBe(0);
  });

  it("does not create admin when other users exist", async () => {
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save({
      username: "other-user",
      passwordHash: await hashPassword("pwd"),
    });

    process.env.DEFAULT_ADMIN_USERNAME = "admin";
    process.env.DEFAULT_ADMIN_PASSWORD = "password123";

    await seedDefaultAdmin();

    const count = await userRepo.count();
    expect(count).toBe(1);

    const admin = await userRepo.findOne({ where: { username: "admin" } });
    expect(admin).toBeNull();
  });
});
