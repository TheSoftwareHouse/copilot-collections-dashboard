import { createSign } from "crypto";

function toBase64Url(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64url");
}

export function generateAppJwt(appId: number, privateKeyPem: string): string {
  if (!privateKeyPem || privateKeyPem.trim() === "") {
    throw new Error("Private key PEM is required for JWT generation");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      iss: appId,
      iat: nowSeconds - 60,
      exp: nowSeconds + 600,
    }),
  );

  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(privateKeyPem, "base64url");

  return `${signingInput}.${signature}`;
}
