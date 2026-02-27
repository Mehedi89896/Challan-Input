import { NextRequest, NextResponse } from "next/server";
import { apiGuard, verifyCsrf, sanitizeInput } from "@/lib/security";

/* ─────────── Shared ERP session (single session for all steps) ─────────── */

interface ErpSession {
  baseUrl: string;
  erpOrigin: string;
  headersCommon: Record<string, string>;
  post: (url: string, body: string, extraHeaders?: Record<string, string>) => Promise<Response>;
  get: (url: string, extraHeaders?: Record<string, string>) => Promise<Response>;
}

async function createErpSession(clientUA: string): Promise<ErpSession> {
  const baseUrl = process.env.ERP_BASE_URL!;
  const erpOrigin = new URL(baseUrl).origin;

  const headersCommon: Record<string, string> = {
    "User-Agent":
      clientUA ||
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
    "Accept-Encoding": "gzip, deflate",
    Referer: `${baseUrl}/login.php`,
  };

  const cookieJar: Record<string, string> = {};

  function getCookieHeader(): string {
    return Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  function parseCookies(response: Response) {
    const setCookies = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookies) {
      const parts = cookie.split(";")[0].split("=");
      if (parts.length >= 2) {
        cookieJar[parts[0].trim()] = parts.slice(1).join("=").trim();
      }
    }
  }

  async function sessionPost(
    url: string,
    body: string,
    extraHeaders?: Record<string, string>,
    retries = 3
  ): Promise<Response> {
    const headers = { ...headersCommon, ...extraHeaders, Cookie: getCookieHeader() };
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, { method: "POST", headers, body, redirect: "manual" });
        parseCookies(res);
        return res;
      } catch {
        if (i === retries - 1) throw new Error(`Failed after ${retries} retries: ${url}`);
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw new Error("Unreachable");
  }

  async function sessionGet(
    url: string,
    extraHeaders?: Record<string, string>,
    retries = 3
  ): Promise<Response> {
    const headers = { ...headersCommon, ...extraHeaders, Cookie: getCookieHeader() };
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, { method: "GET", headers, redirect: "manual" });
        parseCookies(res);
        return res;
      } catch {
        if (i === retries - 1) throw new Error(`Failed after ${retries} retries: ${url}`);
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw new Error("Unreachable");
  }

  // ── Login ──
  const loginBody = new URLSearchParams({
    txt_userid: process.env.ERP_USERNAME!,
    txt_password: process.env.ERP_PASSWORD!,
    submit: "Login",
  }).toString();

  await sessionPost(`${baseUrl}/login.php`, loginBody, {
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: erpOrigin + "/",
  });

  // ── Menu activation (required by ERP for report access) ──
  try {
    await sessionGet(`${baseUrl}/tools/valid_user_action.php?menuid=724`, {
      Referer: `${baseUrl}/production/reports/bundle_wise_sewing_tracking_report.php?permission=1_1_1_1`,
    });
  } catch {
    // Non-critical
  }

  return {
    baseUrl,
    erpOrigin,
    headersCommon,
    post: sessionPost,
    get: sessionGet,
  };
}

/* ─────────── Search flow: job number → tracking → colors (single session) ─────────── */

interface ColorItem {
  id: string;
  name: string;
}

interface SearchResult {
  extractedNumber: string;
  internalId: string;
  fullCclbdNo: string;
  colors: ColorItem[];
}

async function searchIntRef(
  intRef: string,
  companyId: string,
  clientUA: string
): Promise<SearchResult> {
  const s = await createErpSession(clientUA);

  const reportUrl = `${s.baseUrl}/production/reports/requires/sewing_input_and_output_report_controller.php`;
  const trackingUrl = `${s.baseUrl}/production/reports/requires/bundle_wise_sewing_tracking_report_controller.php`;

  // ── Step 1: Get Job Number ──
  const reportPayload = new URLSearchParams({
    action: "generate_report",
    cbo_company_name: companyId,
    hidden_job_id: "",
    hidden_color_id: "",
    cbo_year: "0",
    cbo_wo_company_name: "0",
    cbo_location_name: "0",
    hidden_floor_id: "",
    hidden_line_id: "",
    txt_int_ref: intRef,
    type: "1",
    report_title: "❏ Sewing Input and Output Report",
  }).toString();

  const reportRes = await s.post(reportUrl, reportPayload, {
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: s.erpOrigin,
    Referer: `${s.baseUrl}/production/reports/sewing_input_and_output_report.php?permission=1_1_1_1`,
  });

  const reportText = await reportRes.text();
  const jobMatch = reportText.match(/open_job_qty_popup\('[^']+','([^']+)'\)/);
  if (!jobMatch) {
    throw new Error("No Job Number found for this Int. Ref.");
  }

  const fullJobNo = jobMatch[1];
  const extractedNumber = String(parseInt(fullJobNo.split("-").pop() || "0", 10));

  // ── Step 2: Get Tracking Data ──
  const trackingDataStr = `${companyId}**0**1**${extractedNumber}**0`;
  const trackingParams = new URLSearchParams({
    data: trackingDataStr,
    action: "search_list_view",
  });

  const trackingRes = await s.get(
    `${trackingUrl}?${trackingParams.toString()}`,
    {
      Referer: `${trackingUrl}?action=search_by_action&lc_company=${companyId}&buyer=0&permission=1_1_1_1`,
    }
  );

  const trackingText = await trackingRes.text();
  const trackingMatch = trackingText.match(/js_set_value\('[^_]+_([^_]+)_([^']+)'\)/);
  if (!trackingMatch) {
    throw new Error("Tracking data not found in response.");
  }

  const internalId = trackingMatch[1];
  const fullCclbdNo = trackingMatch[2];

  // ── Step 3: Get Colors ──
  const colorParams = new URLSearchParams({
    action: "color_popup",
    txt_job_no: fullCclbdNo,
    txt_job_id: internalId,
    permission: "1_1_1_1",
  });

  const colorRes = await s.get(
    `${trackingUrl}?${colorParams.toString()}`,
    {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Upgrade-Insecure-Requests": "1",
      Referer: `${s.baseUrl}/production/reports/bundle_wise_sewing_tracking_report.php?permission=1_1_1_1`,
    }
  );

  const colorHtml = await colorRes.text();

  // Parse colors — find all <tr id="tr_NNN" ...> rows
  const colors: ColorItem[] = [];
  const trRegex = /<tr[^>]+id="tr_\d+"[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(colorHtml)) !== null) {
    const rowHtml = trMatch[0];
    const onclickMatch = rowHtml.match(/js_set_value\('\d+_(\d+)'\)/);
    if (!onclickMatch) continue;

    const colorId = onclickMatch[1];

    // Extract all <td> contents
    const tds: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    // 4th column (index 3) is color name
    if (tds.length >= 4) {
      colors.push({ id: colorId, name: tds[3] });
    }
  }

  return { extractedNumber, internalId, fullCclbdNo, colors };
}

/* ─────────── Report flow: final tracking report (single session) ─────────── */

interface BundleRow {
  barcode: string;
  cuttingNo: string;
  bundleNo: string;
  size: string;
  qty: string;
  inputDate: string;
  challanNo: string;
  lineNo: string;
  sewingOutput: string;
}

async function generateReport(
  companyId: string,
  fullCclbdNo: string,
  internalId: string,
  colorId: string,
  scanChoice: "scanned" | "unscanned",
  clientUA: string
): Promise<BundleRow[]> {
  const s = await createErpSession(clientUA);

  const trackingUrl = `${s.baseUrl}/production/reports/requires/bundle_wise_sewing_tracking_report_controller.php`;

  const finalPayload = new URLSearchParams({
    action: "report_generate",
    cbo_lc_company_id: companyId,
    cbo_working_company_id: "0",
    cbo_location_id: "0",
    cbo_floor_id: "0",
    cbo_buyer_id: "0",
    txt_job_no: fullCclbdNo,
    txt_file_no: "",
    txt_int_ref: "",
    color_id: colorId,
    txt_cutting_no: "",
    txt_bunle_no: "",
    txt_date_from: "",
    txt_date_to: "",
    txt_job_id: internalId,
    txt_color_name: colorId,
    type: "2",
  }).toString();

  const finalRes = await s.post(trackingUrl, finalPayload, {
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: s.erpOrigin,
    Referer: `${s.baseUrl}/production/reports/bundle_wise_sewing_tracking_report.php?permission=1_1_1_1`,
  });

  const finalHtml = await finalRes.text();

  // Parse data rows
  const filteredData: BundleRow[] = [];
  const trRegex = /<tr[^>]+id="tr_\w+"[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(finalHtml)) !== null) {
    const rowHtml = trMatch[0];

    // Extract all <td> contents
    const tds: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    if (tds.length < 24) continue;

    const barcode = tds[1];
    const cuttingNo = tds[2];
    const size = tds[3];
    const bundleNo = tds[4];
    const cuttingQc = tds[5].toLowerCase();
    const sewingScan = tds[15].toLowerCase();
    const inputDate = tds[16];
    const challanNo = tds[17];
    const sewingOutput = tds[18];
    const lineNo = tds[21];
    const qty = tds[22];

    if (cuttingQc !== "yes") continue;

    if (scanChoice === "scanned" && sewingScan === "yes") {
      filteredData.push({ barcode, cuttingNo, bundleNo, size, qty, inputDate, challanNo, lineNo, sewingOutput });
    } else if (scanChoice === "unscanned" && sewingScan === "no") {
      filteredData.push({ barcode, cuttingNo, bundleNo, size, qty, inputDate, challanNo, lineNo, sewingOutput });
    }
  }

  return filteredData;
}

/* ═══════════════════════════════════════════════════════════════
   API Route
   ═══════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  const guardResult = apiGuard(request, { maxRate: 10, refillRate: 1 });
  if (guardResult) return guardResult;

  if (!verifyCsrf(request)) {
    return NextResponse.json(
      { error: "Security token invalid — please refresh the page" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action } = body;
    const clientUA = request.headers.get("User-Agent") || "";

    /* ── Action: search ── */
    if (action === "search") {
      const intRef = sanitizeInput(body.int_ref || "", 50);
      const companyId = sanitizeInput(body.company_id || "", 5).replace(/[^0-9]/g, "");

      if (!intRef || !companyId) {
        return NextResponse.json({ error: "Missing Int. Ref. or Company" }, { status: 400 });
      }

      const result = await searchIntRef(intRef, companyId, clientUA);

      if (result.colors.length === 0) {
        return NextResponse.json({ error: "No color data found." }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        extractedNumber: result.extractedNumber,
        internalId: result.internalId,
        fullCclbdNo: result.fullCclbdNo,
        colors: result.colors,
      });
    }

    /* ── Action: report ── */
    if (action === "report") {
      const companyId = sanitizeInput(body.company_id || "", 5).replace(/[^0-9]/g, "");
      const fullCclbdNo = sanitizeInput(body.full_cclbd_no || "", 100);
      const internalId = sanitizeInput(body.internal_id || "", 50);
      // Support multiple color IDs (comma-separated)
      const rawColorIds: string = sanitizeInput(body.color_ids || body.color_id || "", 200);
      const colorIds = rawColorIds.split(",").map(id => id.replace(/[^0-9]/g, "").trim()).filter(Boolean);
      const scanChoice = body.scan_choice === "scanned" ? "scanned" : "unscanned";

      if (!companyId || !fullCclbdNo || !internalId || colorIds.length === 0) {
        return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
      }

      // Fetch reports for all selected colors and merge
      const allData: BundleRow[] = [];
      for (const colorId of colorIds) {
        const data = await generateReport(
          companyId,
          fullCclbdNo,
          internalId,
          colorId,
          scanChoice as "scanned" | "unscanned",
          clientUA
        );
        allData.push(...data);
      }

      return NextResponse.json({
        success: true,
        data: allData,
        total: allData.length,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
