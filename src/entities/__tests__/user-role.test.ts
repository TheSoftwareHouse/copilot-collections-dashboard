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

beforeAll(async () => {
  testDs = await getTestDataSource();
});

afterAll(async () => {
  await destroyTestDataSource();
});

beforeEach(async () => {
  await cleanDatabase(testDs);
});

describe("User role column", () => {
  it("defaults to 'user' when role is not specified", async () => {
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.save({
      username: "testuser",
      passwordHash: "hashed",
    });

    const found = await userRepo.findOneBy({ id: user.id });
    expect(found).not.toBeNull();
    expect(found!.role).toBe(UserRole.USER);
  });

  it("stores admin role correctly", async () => {
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.save({
      username: "adminuser",
      passwordHash: "hashed",
      role: UserRole.ADMIN,
    });

    const found = await userRepo.findOneBy({ id: user.id });
    expect(found).not.toBeNull();
    expect(found!.role).toBe(UserRole.ADMIN);
  });

  it("can filter users by role", async () => {
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save([
      { username: "admin1", passwordHash: "h", role: UserRole.ADMIN },
      { username: "user1", passwordHash: "h" },
      { username: "user2", passwordHash: "h" },
    ]);

    const admins = await userRepo.find({ where: { role: UserRole.ADMIN } });
    expect(admins).toHaveLength(1);
    expect(admins[0].username).toBe("admin1");

    const users = await userRepo.find({ where: { role: UserRole.USER } });
    expect(users).toHaveLength(2);
  });
});
