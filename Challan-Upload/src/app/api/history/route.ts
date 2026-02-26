import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = 20;
    const skip = (page - 1) * limit;

    // Search filters
    const challanNo = sp.get("challan_no")?.trim() || "";
    const lineNo = sp.get("line_no")?.trim() || "";
    const date = sp.get("date")?.trim() || "";
    const bookingNo = sp.get("booking_no")?.trim() || "";

    const db = await getDb();
    const col = db.collection("challans");

    // Build query
    const query: Record<string, unknown> = {};
    if (challanNo) query.challan_no = { $regex: challanNo, $options: "i" };
    if (lineNo) query.line_no = { $regex: lineNo, $options: "i" };
    if (date) query.date = { $regex: date, $options: "i" };
    if (bookingNo) query.booking_no = { $regex: bookingNo, $options: "i" };

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
      entries: entries.map((e) => ({
        id: e._id.toString(),
        challan_no: e.challan_no || "",
        system_id: e.system_id || "",
        company_name: e.company_name || "",
        booking_no: e.booking_no || "",
        line_no: e.line_no || "",
        color: e.color || "",
        date: e.date || "",
        total_quantity: e.total_quantity || 0,
        report1_url: e.report1_url || "",
        report2_url: e.report2_url || "",
        created_at: e.created_at || null,
      })),
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
