import { NextRequest, NextResponse } from "next/server";
import {
  createHash,
  randomBytes,
  timingSafeEqual,
  createCipheriv,
} from "crypto";
import { deriveKey } from "@/lib/crypto";

/**
 * Secure admin authentication with:
 *  1. Challenge-response login  — password NEVER leaves the client
 *  2. PBKDF2-encrypted session key exchange
 *  3. HttpOnly cookie for auth token (invisible to JS / DevTools)
 *  4. Rate limiting + timing-safe comparisons
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

// ── Challenge store (single-use, 60 s TTL) ──
const challenges = new Map<
  string,
  { challenge: string; createdAt: number }
>();
const CHALLENGE_TTL = 60_000;

// ── Session store  token → AES session key ──
const sessions = new Map<
  string,
  { sessionKey: Buffer; createdAt: number }
>();

/** Periodically clean expired entries */
function cleanup() {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (now - c.createdAt > CHALLENGE_TTL) challenges.delete(id);
  }
  for (const [t, s] of sessions) {
    if (now - s.createdAt > TOKEN_TTL) sessions.delete(t);
  }
}

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

/** Retrieve the AES-256 session key bound to a valid token. */
export function getSessionKey(token: string): Buffer | null {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > TOKEN_TTL) {
    sessions.delete(token);
    return null;
  }
  return s.sessionKey;
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

// ── GET: Issue a one-time challenge nonce ──
export async function GET() {
  cleanup();
  const challengeId = randomBytes(16).toString("hex");
  const challenge = randomBytes(32).toString("hex");
  challenges.set(challengeId, { challenge, createdAt: Date.now() });
  return NextResponse.json({ challengeId, challenge });
}

// ── POST: Verify challenge-response proof & create encrypted session ──
export async function POST(request: NextRequest) {
  cleanup();

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
    const { username, challengeId, proof } = body;

    if (!username || !challengeId || !proof) {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    // ─ Validate challenge ─
    const entry = challenges.get(challengeId);
    if (!entry || Date.now() - entry.createdAt > CHALLENGE_TTL) {
      challenges.delete(challengeId);
      return NextResponse.json(
        { error: "Challenge expired — please retry" },
        { status: 400 }
      );
    }
    challenges.delete(challengeId); // single-use

    // ─ Verify credentials via challenge-response ─
    const validUser = process.env.DELETE_USERNAME || "Mehedi";
    const validPass = process.env.DELETE_PASSWORD || "@Nijhum@12";

    const userOk = safeCompare(username, validUser);

    // Expected proof = SHA256( SHA256(password) + challenge )
    const passHash = createHash("sha256").update(validPass).digest("hex");
    const expectedProof = createHash("sha256")
      .update(passHash + entry.challenge)
      .digest("hex");
    const proofOk = safeCompare(proof, expectedProof);

    if (!userOk || !proofOk) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ─ Create session ─
    const token = generateToken();
    const sessionKey = randomBytes(32); // AES-256 key for payload encryption
    sessions.set(token, { sessionKey, createdAt: Date.now() });

    // Encrypt sessionKey with PBKDF2(password, challenge) so client can derive
    const derived = deriveKey(validPass, entry.challenge);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", derived, iv);
    const enc = Buffer.concat([cipher.update(sessionKey), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Build response — session key is encrypted, token goes in HttpOnly cookie
    const isSecure = request.url.startsWith("https");
    const response = NextResponse.json({
      encryptedKey: enc.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
    });

    response.cookies.set("__del_token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: isSecure,
      path: "/",
      maxAge: 30 * 60,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
