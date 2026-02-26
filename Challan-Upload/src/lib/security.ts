/**
 * Centralized security utilities shared by ALL API routes.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Layer 1 — CSRF: per-session double-submit cookie token     │
 * │  Layer 2 — Rate limiter: per-IP sliding window              │
 * │  Layer 3 — Request signature: HMAC-SHA256 integrity check   │
 * │  Layer 4 — Origin validation: reject cross-origin calls     │
 * │  Layer 5 — Input sanitizer: NoSQL injection prevention      │
 * └─────────────────────────────────────────────────────────────┘
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// ─────────── HMAC Request Signature ───────────
// Shared secret — env or randomly generated per instance
const API_SECRET =
  process.env.API_HMAC_SECRET || randomBytes(32).toString("hex");

/** Sign data with HMAC-SHA256 */
export function hmacSign(data: string): string {
  return createHmac("sha256", API_SECRET).update(data).digest("hex");
}

/** Verify an HMAC signature (timing-safe) */
export function hmacVerify(data: string, signature: string): boolean {
  const expected = hmacSign(data);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(
    Buffer.from(expected, "utf-8"),
    Buffer.from(signature, "utf-8")
  );
}

// ─────────── CSRF Token ───────────
const CSRF_TTL = 60 * 60 * 1000; // 1 hour

/** Generate a CSRF token (random + timestamp + HMAC) */
export function generateCsrfToken(): string {
  const nonce = randomBytes(16).toString("hex");
  const ts = Date.now().toString(36);
  const payload = `${nonce}:${ts}`;
  const sig = hmacSign(payload);
  return `${payload}:${sig}`;
}

/** Verify a CSRF token */
export function verifyCsrfToken(token: string): boolean {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [nonce, ts, sig] = parts;
  const payload = `${nonce}:${ts}`;

  // Timing-safe signature check
  if (!hmacVerify(payload, sig)) return false;

  // Check expiry
  const created = parseInt(ts, 36);
  if (isNaN(created) || Date.now() - created > CSRF_TTL) return false;

  return true;
}

// ─────────── Rate Limiter ───────────
interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Token-bucket rate limiter.
 * @param ip      Client IP
 * @param max     Bucket capacity (max burst)
 * @param refill  Tokens added per second
 * @returns true if request is allowed
 */
export function checkRateLimit(
  ip: string,
  max = 30,
  refill = 2
): boolean {
  const now = Date.now();
  let entry = rateLimitStore.get(ip);

  if (!entry) {
    entry = { tokens: max - 1, lastRefill: now };
    rateLimitStore.set(ip, entry);
    return true;
  }

  // Refill tokens
  const elapsed = (now - entry.lastRefill) / 1000;
  entry.tokens = Math.min(max, entry.tokens + elapsed * refill);
  entry.lastRefill = now;

  if (entry.tokens < 1) return false;
  entry.tokens -= 1;
  return true;
}

// Periodically purge stale entries
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [ip, e] of rateLimitStore) {
      if (e.lastRefill < cutoff) rateLimitStore.delete(ip);
    }
  }, 60_000);
}

// ─────────── IP extraction ───────────
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ─────────── Origin validation ───────────
/**
 * Returns true if the request comes from the same origin.
 * Blocks cross-origin API abuse.
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  // Non-browser tooling (curl, Postman) won't have origin
  // For GET requests with no origin, check referer
  if (!origin && !referer) {
    // Allow server-side calls (no origin header)
    // But block if it's a POST without any origin indicators
    if (request.method === "POST") return false;
    return true;
  }

  if (origin) {
    try {
      const u = new URL(origin);
      if (u.host === host) return true;
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const u = new URL(referer);
      if (u.host === host) return true;
    } catch {
      return false;
    }
  }

  return false;
}

// ─────────── Input sanitization ───────────
/**
 * Strip MongoDB operators ($...) and dangerous characters from query params.
 * Prevents NoSQL injection attacks.
 */
export function sanitizeInput(input: string, maxLen = 200): string {
  if (!input) return "";
  let s = input.trim().substring(0, maxLen);
  // Remove any MongoDB operator patterns
  s = s.replace(/\$[a-zA-Z]+/g, "");
  // Remove potential script injection
  s = s.replace(/[<>"'`;\\]/g, "");
  return s;
}

/** Guard for API routes — validates origin, rate limit, returns 4xx or null */
export function apiGuard(
  request: NextRequest,
  opts?: { maxRate?: number; refillRate?: number; skipOriginCheck?: boolean }
): NextResponse | null {
  const ip = getClientIp(request);

  // Rate limit
  if (!checkRateLimit(ip, opts?.maxRate ?? 30, opts?.refillRate ?? 2)) {
    return NextResponse.json(
      { error: "Rate limited — slow down" },
      { status: 429 }
    );
  }

  // Origin check (POST only by default)
  if (!opts?.skipOriginCheck && request.method === "POST") {
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: "Forbidden — cross-origin request" },
        { status: 403 }
      );
    }
  }

  return null; // all passed
}

// ─────────── CSRF Cookie helpers ───────────
const CSRF_COOKIE = "__csrf";

/** Set CSRF cookie on response */
export function setCsrfCookie(
  response: NextResponse,
  isSecure: boolean
): string {
  const token = generateCsrfToken();
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // JS needs to read this to submit in header
    sameSite: "strict",
    secure: isSecure,
    path: "/",
    maxAge: 3600,
  });
  return token;
}

/** Verify CSRF from request header against cookie */
export function verifyCsrf(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken) return false;
  if (cookieToken !== headerToken) return false;
  return verifyCsrfToken(cookieToken);
}
