import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  apiGuard,
  sanitizeInput,
  hmacSign,
} from "@/lib/security";

export async function GET(request: NextRequest) {
  // ── Security: Rate limit (20 req burst, 3/sec refill) ──
  const guardResult = apiGuard(request, {
    maxRate: 20,
    refillRate: 3,
    skipOriginCheck: true,
  });
  if (guardResult) return guardResult;

  try {
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, Math.min(500, parseInt(sp.get("page") || "1", 10) || 1));
    const limit = 20;
    const skip = (page - 1) * limit;

    // ── Security: Sanitize all search inputs (prevent NoSQL injection) ──
    const challanNo = sanitizeInput(sp.get("challan_no") || "", 30);
    const lineNo = sanitizeInput(sp.get("line_no") || "", 20);
    const date = sanitizeInput(sp.get("date") || "", 20);
    const bookingNo = sanitizeInput(sp.get("booking_no") || "", 40);

    const db = await getDb();
    const col = db.collection("challans");

    // Build query with sanitized, escaped regex patterns
    const query: Record<string, unknown> = {};
    if (challanNo) query.challan_no = { $regex: escapeRegex(challanNo), $options: "i" };
    if (lineNo) query.line_no = { $regex: escapeRegex(lineNo), $options: "i" };
    if (date) query.date = { $regex: escapeRegex(date), $options: "i" };
    if (bookingNo) query.booking_no = { $regex: escapeRegex(bookingNo), $options: "i" };

    // Get total count for pagination
    const total = await col.countDocuments(query);

    // Get paginated results
    const entries = await col
      .find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [today, week, month, grandTotal] = await Promise.all([
      col.countDocuments({ created_at: { $gte: todayStart } }),
      col.countDocuments({ created_at: { $gte: weekAgo } }),
      col.countDocuments({ created_at: { $gte: monthAgo } }),
      col.countDocuments({}),
    ]);

    return NextResponse.json({
      entries: entries.map((e) => {
        // ── Security: Sign report URLs so /api/report can verify origin ──
        const r1 = e.report1_url || "";
        const r2 = e.report2_url || "";
        return {
          id: e._id.toString(),
          challan_no: e.challan_no || "",
          system_id: e.system_id || "",
          company_name: e.company_name || "",
          booking_no: e.booking_no || "",
          line_no: e.line_no || "",
          color: e.color || "",
          date: e.date || "",
          total_quantity: e.total_quantity || 0,
          report1_url: r1,
          report1_sig: r1 ? hmacSign(r1) : "",
          report2_url: r2,
          report2_sig: r2 ? hmacSign(r2) : "",
          created_at: e.created_at || null,
        };
      }),
      stats: { today, week, month, total: grandTotal },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Escape user input for safe use in MongoDB $regex */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
