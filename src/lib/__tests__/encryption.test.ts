/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// A valid 64-hex-character key (32 bytes)
const VALID_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let originalKey: string | undefined;

beforeEach(() => {
  originalKey = process.env.ENCRYPTION_KEY;
});

afterEach(() => {
  if (originalKey !== undefined) {
    process.env.ENCRYPTION_KEY = originalKey;
  } else {
    delete process.env.ENCRYPTION_KEY;
  }
});

describe("encryption", () => {
  describe("encrypt → decrypt round-trip", () => {
    it("produces original plaintext", async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;
      const { encrypt, decrypt } = await import("@/lib/encryption");

      const plaintext = "This is a secret private key PEM content";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("works with multiline PEM content", async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;
      const { encrypt, decrypt } = await import("@/lib/encryption");

      const pem = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/yGxAj
SomeBase64ContentHere==
-----END RSA PRIVATE KEY-----`;

      const encrypted = encrypt(pem);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(pem);
    });

    it("works with empty string", async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;
      const { encrypt, decrypt } = await import("@/lib/encryption");

      const encrypted = encrypt("");
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe("");
    });
  });

  describe("random IV produces different ciphertext", () => {
    it("encrypting the same plaintext twice produces different ciphertext", async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;
      const { encrypt } = await import("@/lib/encryption");

      const plaintext = "identical plaintext";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe("tamper detection", () => {
    it("throws when ciphertext is tampered with", async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;
      const { encrypt, decrypt } = await import("@/lib/encryption");

      const encrypted = encrypt("secret data");
      const parts = encrypted.split(":");

      // Tamper with the ciphertext portion
      const data = Buffer.from(parts[2], "base64");
      data[0] = data[0] ^ 0xff;
      parts[2] = data.toString("base64");
      const tampered = parts.join(":");

      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws when auth tag is tampered with", async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;
      const { encrypt, decrypt } = await import("@/lib/encryption");

      const encrypted = encrypt("secret data");
      const parts = encrypted.split(":");

      // Tamper with the auth tag
      const tag = Buffer.from(parts[1], "base64");
      tag[0] = tag[0] ^ 0xff;
      parts[1] = tag.toString("base64");
      const tampered = parts.join(":");

      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws for invalid encrypted data format", async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;
      const { decrypt } = await import("@/lib/encryption");

      expect(() => decrypt("not:valid")).toThrow(
        "Invalid encrypted data format",
      );
      expect(() => decrypt("single")).toThrow(
        "Invalid encrypted data format",
      );
    });
  });

  describe("missing ENCRYPTION_KEY", () => {
    it("throws when ENCRYPTION_KEY is not set", async () => {
      delete process.env.ENCRYPTION_KEY;
      const { encrypt } = await import("@/lib/encryption");

      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_KEY environment variable is not set",
      );
    });

    it("throws when ENCRYPTION_KEY is empty", async () => {
      process.env.ENCRYPTION_KEY = "";
      const { encrypt } = await import("@/lib/encryption");

      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_KEY environment variable is not set",
      );
    });
  });

  describe("invalid ENCRYPTION_KEY format", () => {
    it("throws when key is too short", async () => {
      process.env.ENCRYPTION_KEY = "0123456789abcdef";
      const { encrypt } = await import("@/lib/encryption");

      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_KEY must be exactly 64 hexadecimal characters",
      );
    });

    it("throws when key is too long", async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY + "ff";
      const { encrypt } = await import("@/lib/encryption");

      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_KEY must be exactly 64 hexadecimal characters",
      );
    });

    it("throws when key contains non-hex characters", async () => {
      process.env.ENCRYPTION_KEY = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
      const { encrypt } = await import("@/lib/encryption");

      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_KEY must be exactly 64 hexadecimal characters",
      );
    });
  });
});
