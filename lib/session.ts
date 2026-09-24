// Signed session tokens. The cookie must never contain AUTH_SECRET itself — a leaked cookie
// would then be the environment secret, unrevocable and shared by every session.
//
// Uses Web Crypto, which is available both in the proxy and in route handlers, so one
// implementation serves both. (The proxy runs on the Node.js runtime as of Next 16.)

const encoder = new TextEncoder();

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface Payload {
  /** issued-at, epoch seconds */
  iat: number;
  /** expires-at, epoch seconds */
  exp: number;
  /** random, so two tokens issued in the same second still differ */
  jti: string;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns an ArrayBuffer-backed view explicitly: Uint8Array.from() widens to ArrayBufferLike,
// which crypto.subtle's BufferSource parameter rejects under strict TS.
function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = {
    iat: now,
    exp: now + SESSION_MAX_AGE,
    jti: b64urlEncode(crypto.getRandomValues(new Uint8Array(12))),
  };
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Constant-time via crypto.subtle.verify — no early-exit string compare. */
export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      b64urlDecode(sig),
      encoder.encode(body)
    );
    if (!ok) return false;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as Payload;
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

// ─── The nightly report's token ──────────────────────────────────────────────

/**
 * The scheduled review reads exactly one endpoint with its own token, rather than holding the
 * site password — which would unlock everything, including writes.
 */
export const REPORT_PATH = "/api/study/review";

/** Shorter tokens are refused outright, so a weak one cannot be set by accident. */
export const REPORT_TOKEN_MIN_LENGTH = 32;

/**
 * Checks an `Authorization: Bearer …` header against REPORT_TOKEN.
 *
 * Fails closed: with the token unset or too short nothing matches, so a blank variable can never
 * turn into `"" === ""`. The comparison is over SHA-256 digests — always 32 bytes — with no early
 * exit, so it reveals neither the token's length nor where the first wrong character is.
 */
export async function verifyReportToken(
  header: string | null,
  expected: string | undefined,
): Promise<boolean> {
  const want = expected?.trim();
  if (!want || want.length < REPORT_TOKEN_MIN_LENGTH) return false;
  if (!header?.startsWith("Bearer ")) return false;
  const presented = header.slice("Bearer ".length).trim();
  if (presented === "") return false;

  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(presented)),
    crypto.subtle.digest("SHA-256", encoder.encode(want)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
