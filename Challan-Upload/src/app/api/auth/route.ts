import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Secure admin authentication endpoint.
 * - Credentials verified server-side only (never exposed to client)
 * - Uses timing-safe comparison to prevent timing attacks
 * - Returns a signed HMAC token valid for 30 minutes
 * - Rate limiting via in-memory tracker
 */

// ── Rate limiter ──
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

// ── Token generation ──
const TOKEN_SECRET =
  process.env.DELETE_TOKEN_SECRET || randomBytes(32).toString("hex");
const TOKEN_TTL = 30 * 60 * 1000; // 30 minutes

function generateToken(): string {
  const payload = `${Date.now()}:${randomBytes(16).toString("hex")}`;
  const sig = createHash("sha256")
    .update(payload + TOKEN_SECRET)
    .digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyToken(token: string): boolean {
  try {
    const raw = Buffer.from(token, "base64url").toString();
    const parts = raw.split(":");
    if (parts.length < 3) return false;

    const timestamp = parseInt(parts[0], 10);
    const nonce = parts[1];
    const providedSig = parts.slice(2).join(":");

    // Check expiry
    if (Date.now() - timestamp > TOKEN_TTL) return false;

    // Recompute signature
    const expectedSig = createHash("sha256")
      .update(`${timestamp}:${nonce}${TOKEN_SECRET}`)
      .digest("hex");

    // Timing-safe comparison
    const a = Buffer.from(providedSig, "utf-8");
    const b = Buffer.from(expectedSig, "utf-8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Secure credential comparison ──
function safeCompare(input: string, expected: string): boolean {
  const a = Buffer.from(input, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  if (a.length !== b.length) {
    // Still do a comparison to keep constant time
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  // Get client IP for rate limiting
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Credentials required" },
        { status: 400 }
      );
    }

    const validUser = process.env.DELETE_USERNAME || "Mehedi";
    const validPass = process.env.DELETE_PASSWORD || "@Nijhum@12";

    const userOk = safeCompare(username, validUser);
    const passOk = safeCompare(password, validPass);

    if (!userOk || !passOk) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Generate secure token
    const token = generateToken();

    return NextResponse.json({ token });
  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
