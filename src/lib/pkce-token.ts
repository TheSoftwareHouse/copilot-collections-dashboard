import { createHmac, randomBytes } from "crypto";

/**
 * PKCE token utility — encodes state + codeVerifier into a signed,
 * base64url-encoded token that travels via the OAuth `state` parameter.
 *
 * This eliminates all cookie dependencies for the PKCE flow.
 * Azure returns the `state` param unchanged in the callback, so the
 * server can extract and verify the payload without any storage.
 *
 * The token is HMAC-SHA256 signed with an ephemeral in-memory secret
 * generated at process start. A server restart invalidates any in-flight
 * login attempts — identical behaviour to cookie-based PKCE.
 */

const SECRET = randomBytes(32);
const TOKEN_TTL_SECONDS = 300; // 5 minutes

interface PkcePayload {
  /** The original random state value */
  state: string;
  /** PKCE code verifier */
  codeVerifier: string;
  /** Expiry timestamp (seconds since epoch) */
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

function toBase64Url(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function fromBase64Url(b64: string): string {
  return Buffer.from(b64, "base64url").toString("utf8");
}

/**
 * Create a signed PKCE token containing the state and code verifier.
 * The returned string is safe for use as an OAuth `state` parameter.
 */
export function createPkceToken(state: string, codeVerifier: string): string {
  const payload: PkcePayload = {
    state,
    codeVerifier,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a PKCE token.
 * Returns the original state and codeVerifier on success.
 * Throws a descriptive Error on failure.
 */
export function verifyPkceToken(token: string): { state: string; codeVerifier: string } {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("Malformed PKCE token: expected 2 parts");
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = sign(encodedPayload);

  if (signature !== expectedSignature) {
    throw new Error("Invalid PKCE token signature");
  }

  let payload: PkcePayload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as PkcePayload;
  } catch {
    throw new Error("Malformed PKCE token payload");
  }

  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("PKCE token has expired");
  }

  if (!payload.state || !payload.codeVerifier) {
    throw new Error("PKCE token missing required fields");
  }

  return { state: payload.state, codeVerifier: payload.codeVerifier };
}
