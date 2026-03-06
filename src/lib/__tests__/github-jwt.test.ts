/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";
import { generateKeyPairSync, createVerify } from "crypto";
import { generateAppJwt } from "@/lib/github-jwt";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

describe("generateAppJwt", () => {
  it("returns a JWT with three dot-separated parts", () => {
    const jwt = generateAppJwt(12345, privateKey);
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
    parts.forEach((part) => expect(part.length).toBeGreaterThan(0));
  });

  it("header decodes to RS256 algorithm", () => {
    const jwt = generateAppJwt(12345, privateKey);
    const header = JSON.parse(
      Buffer.from(jwt.split(".")[0], "base64url").toString(),
    );
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
  });

  it("payload contains iss matching appId", () => {
    const jwt = generateAppJwt(99999, privateKey);
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString(),
    );
    expect(payload.iss).toBe(99999);
  });

  it("payload contains iat and exp with exp > iat", () => {
    const jwt = generateAppJwt(12345, privateKey);
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString(),
    );
    expect(payload.iat).toBeTypeOf("number");
    expect(payload.exp).toBeTypeOf("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("signature is valid and verifiable with public key", () => {
    const jwt = generateAppJwt(12345, privateKey);
    const [headerB64, payloadB64, signatureB64] = jwt.split(".");
    const signingInput = `${headerB64}.${payloadB64}`;

    const verifier = createVerify("RSA-SHA256");
    verifier.update(signingInput);
    const isValid = verifier.verify(
      publicKey,
      signatureB64,
      "base64url",
    );
    expect(isValid).toBe(true);
  });

  it("throws when private key PEM is empty", () => {
    expect(() => generateAppJwt(12345, "")).toThrow(
      "Private key PEM is required",
    );
  });

  it("throws when private key PEM is invalid", () => {
    expect(() => generateAppJwt(12345, "not-a-valid-pem")).toThrow();
  });
});
