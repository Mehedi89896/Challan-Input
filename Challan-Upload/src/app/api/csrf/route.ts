import { NextRequest, NextResponse } from "next/server";
import { setCsrfCookie, apiGuard } from "@/lib/security";

/**
 * GET /api/csrf — returns a fresh CSRF token cookie.
 * Called once when the client page loads.
 */
export async function GET(request: NextRequest) {
  const guardResult = apiGuard(request, { maxRate: 30, refillRate: 5, skipOriginCheck: true });
  if (guardResult) return guardResult;

  const isSecure = request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:";

  const res = NextResponse.json({ ok: true });
  setCsrfCookie(res, isSecure);
  return res;
}
