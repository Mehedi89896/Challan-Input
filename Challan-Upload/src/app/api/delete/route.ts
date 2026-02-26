import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getSessionKey } from "@/app/api/auth/route";
import { encryptPayload, decryptPayload } from "@/lib/crypto";

/**
 * Delete Challan API
 * Implements the multi-step ERP delete workflow:
 *   1. search   — find system_id from challan number
 *   2. preview  — fetch challan details for confirmation
 *   3. delete   — execute the actual delete operation
 *
 * All endpoints require a valid auth token.
 */

// ── ERP session helpers (shared pattern from process route) ──
function createERPSession() {
  const baseUrl = process.env.ERP_BASE_URL!;
  const erpOrigin = new URL(baseUrl).origin;
  const cookieJar: Record<string, string> = {};

  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const headersCommon: Record<string, string> = {
    "User-Agent": UA,
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: erpOrigin + "/",
    Referer: `${baseUrl}/login.php`,
  };

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

  async function get(url: string, headers?: Record<string, string>): Promise<Response> {
    const res = await fetch(url, {
      method: "GET",
      headers: { ...(headers || headersCommon), Cookie: getCookieHeader() },
      redirect: "manual",
    });
    parseCookies(res);
    return res;
  }

  async function post(
    url: string,
    body: string,
    headers?: Record<string, string>
  ): Promise<Response> {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...(headers || headersCommon), Cookie: getCookieHeader() },
      body,
      redirect: "manual",
    });
    parseCookies(res);
    return res;
  }

  async function login(): Promise<void> {
    // Use the delete-specific ERP creds (different user with delete permissions)
    const loginBody = new URLSearchParams({
      txt_userid: process.env.DELETE_ERP_USERNAME || "sourav.clothing-cuttingqc",
      txt_password: process.env.DELETE_ERP_PASSWORD || "340425",
      submit: "Login",
    }).toString();

    await post(`${baseUrl}/login.php`, loginBody);

    const mainPageUrl = `${baseUrl}/production/bundle_wise_sewing_input.php?permission=1_1_1_1`;

    // Load main page first (required for session setup)
    const pageHeaders = {
      ...headersCommon,
      Referer: `${baseUrl}/login.php`,
    };
    try {
      await get(mainPageUrl, pageHeaders);
    } catch {
      /* non-critical */
    }

    // Session activation
    const menuHeaders = {
      ...headersCommon,
      Referer: mainPageUrl,
    };
    try {
      await get(`${baseUrl}/tools/valid_user_action.php?menuid=724`, menuHeaders);
    } catch {
      /* non-critical */
    }

    const ajaxHeaders: Record<string, string> = {
      "User-Agent": UA,
      "X-Requested-With": "XMLHttpRequest",
      Referer: mainPageUrl,
    };
    try {
      await get(
        `${baseUrl}/includes/common_functions_for_js.php?data=724_7_405&action=create_menu_session`,
        ajaxHeaders
      );
    } catch {
      /* non-critical */
    }
  }

  return { baseUrl, headersCommon, get, post, login, getCookieHeader };
}

export async function POST(request: NextRequest) {
  // 1. Validate auth token from HttpOnly cookie
  const token = request.cookies.get("__del_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json(
      { error: "Unauthorized — session expired or invalid" },
      { status: 401 }
    );
  }

  // 2. Retrieve session encryption key
  const sessionKey = getSessionKey(token);
  if (!sessionKey) {
    return NextResponse.json(
      { error: "Session key expired" },
      { status: 401 }
    );
  }

  // Helper: every response after auth is AES-256-GCM encrypted
  const respond = (data: unknown, status = 200) =>
    NextResponse.json(encryptPayload(data, sessionKey), { status });

  try {
    // 3. Decrypt incoming request body
    const encBody = await request.json();
    if (!encBody?.ct || !encBody?.iv) {
      return respond({ error: "Invalid encrypted payload" }, 400);
    }
    const body = decryptPayload(encBody.ct, encBody.iv, sessionKey) as Record<string, string>;
    const { action, challan_no, company_id, location_id, system_id } = body;

    const erp = createERPSession();
    await erp.login();

    const controllerUrl = `${erp.baseUrl}/production/requires/bundle_wise_sewing_input_controller.php`;

    // ─────────────────────────────────────
    // ACTION: search — find system_id
    // ─────────────────────────────────────
    if (action === "search") {
      if (!challan_no || !company_id) {
        return respond({ error: "Challan number and company required" }, 400);
      }

      const loc = location_id || "1";
      const searchData = `${challan_no}_0__${company_id}_${loc}__1___`;

      // Use proper headers for search (no Content-Type for GET, correct Referer)
      const mainPageUrl = `${erp.baseUrl}/production/bundle_wise_sewing_input.php?permission=1_1_1_1`;
      const searchHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: mainPageUrl,
      };

      const searchRes = await erp.get(
        `${controllerUrl}?data=${searchData}&action=create_challan_search_list_view`,
        searchHeaders
      );
      const searchText = await searchRes.text();

      // Python regex: js_set_value\('(\d+)' — match quoted system_id (2 args in call)
      const match = searchText.match(/js_set_value\('(\d+)'/);
      if (!match) {
        return respond({ error: "Challan not found in ERP system" }, 404);
      }

      return respond({ system_id: match[1] });
    }

    // ─────────────────────────────────────
    // ACTION: preview — get challan details
    // ─────────────────────────────────────
    if (action === "preview") {
      if (!system_id) {
        return respond({ error: "System ID required" }, 400);
      }

      const printData = `1*${system_id}*3*\u274f Bundle Wise Sewing Input*undefined*undefined*undefined*1`;
      const printRes = await erp.get(
        `${controllerUrl}?data=${encodeURIComponent(printData)}&action=sewing_input_challan_print_5`
      );

      if (!printRes.ok) {
        return respond({ error: "Failed to fetch challan details" }, 500);
      }

      const html = await printRes.text();

      // Extract key fields from the HTML table
      const details: Record<string, string> = {};

      // Challan No
      const challanMatch = html.match(
        /Challan No\s*<\/strong>\s*<\/td>\s*<td[^>]*>\s*:\s*([^<]+)/i
      );
      if (challanMatch) details.challan_no = challanMatch[1].trim();

      // Input Date
      const dateMatch = html.match(
        /Input Date\s*<\/strong>\s*<\/td>\s*<td[^>]*>\s*:?\s*:?\s*([^<]+)/i
      );
      if (dateMatch) details.input_date = dateMatch[1].trim();

      // Sewing Company
      const compMatch = html.match(
        /Sewing Company\s*<\/strong>\s*<\/td>\s*<td[^>]*>\s*:\s*([^<]+)/i
      );
      if (compMatch) details.sewing_company = compMatch[1].trim();

      // Floor
      const floorMatch = html.match(
        /Floor\s*<\/strong>\s*<\/td>\s*<td[^>]*>\s*:\s*([^<]+)/i
      );
      if (floorMatch) details.floor = floorMatch[1].trim();

      // Line
      const lineMatch = html.match(
        /<strong>\s*Line\s*<\/strong>\s*<\/td>\s*<td[^>]*>\s*:\s*([^<]+)/i
      );
      if (lineMatch) details.line = lineMatch[1].trim();

      // Location
      const locMatch = html.match(
        /Location\s*<\/strong>\s*<\/td>\s*<td[^>]*>\s*:\s*([^<]+)/i
      );
      if (locMatch) details.location = locMatch[1].trim();

      // Sewing Source
      const sourceMatch = html.match(
        /Sewing Source\s*<\/strong>\s*<\/td>\s*<td[^>]*>\s*:\s*([^<]+)/i
      );
      if (sourceMatch) details.sewing_source = sourceMatch[1].trim();

      // Buyer
      const buyerMatch = html.match(
        /<tbody>\s*<tr[^>]*>\s*(?:<td[^>]*>[\s\S]*?<\/td>\s*){1}<td[^>]*>([\s\S]*?)<\/td>/i
      );
      if (buyerMatch) {
        details.buyer = buyerMatch[1].replace(/<[^>]*>/g, "").trim();
      }

      // Style Ref (4th td in data row)
      const styleMatch = html.match(
        /<tbody>\s*<tr[^>]*>\s*(?:<td[^>]*>[\s\S]*?<\/td>\s*){3}<td[^>]*>([\s\S]*?)<\/td>/i
      );
      if (styleMatch) {
        details.style_ref = styleMatch[1].replace(/<[^>]*>/g, "").trim();
      }

      // Internal Ref / Booking No (5th td)
      const refMatch = html.match(
        /<tbody>\s*<tr[^>]*>\s*(?:<td[^>]*>[\s\S]*?<\/td>\s*){4}<td[^>]*>([\s\S]*?)<\/td>/i
      );
      if (refMatch) {
        details.booking_no = refMatch[1].replace(/<[^>]*>/g, "").trim();
      }

      // Color (from data rows)
      const colorMatch = html.match(
        /<td[^>]*>([^<]{2,})<\/td>\s*<td[^>]*width="50"/i
      );
      if (colorMatch) {
        const val = colorMatch[1].trim();
        if (val && !/^\d+$/.test(val)) details.color = val;
      }

      // Grand Total
      const gtIdx = html.indexOf("Grand Total");
      if (gtIdx !== -1) {
        const afterGt = html.substring(gtIdx);
        const qtyMatch = afterGt.match(
          /(?:<td[^>]*width="50"[^>]*>[^<]*<\/td>\s*)+<td[^>]*>(\d+)<\/td>/i
        );
        if (qtyMatch) details.total_qty = qtyMatch[1];

        // Total bundles - next td
        const bundleMatch = afterGt.match(
          /(?:<td[^>]*width="50"[^>]*>[^<]*<\/td>\s*)+<td[^>]*>\d+<\/td>\s*<td[^>]*>(\d+)<\/td>/i
        );
        if (bundleMatch) details.total_bundles = bundleMatch[1];
      }

      return respond({ details });
    }

    // ─────────────────────────────────────
    // ACTION: delete — execute delete
    // ─────────────────────────────────────
    if (action === "delete") {
      if (!system_id || !challan_no || !company_id) {
        return respond({ error: "System ID, challan number, and company required" }, 400);
      }

      const loc = location_id || "1";
      const { "Content-Type": _, ...noCT } = erp.headersCommon;
      void _;
      const ajaxHeaders = { ...noCT, "X-Requested-With": "XMLHttpRequest" };

      // Step 1: Get barcodes
      const bunRes = await erp.get(
        `${controllerUrl}?data=${system_id}&action=bundle_nos`,
        ajaxHeaders
      );
      const bunText = await bunRes.text();
      const barcodesString = bunText.trim().split("**")[0];

      if (!barcodesString) {
        return respond({ error: "No bundles found for this challan" }, 404);
      }

      // Step 2: Get header data (line_no, floor_id, issue_date)
      const popBody = new URLSearchParams({
        rndval: String(Date.now()),
      }).toString();
      const popRes = await erp.post(
        `${controllerUrl}?data=${system_id}&action=populate_data_from_challan_popup`,
        popBody
      );
      const popText = await popRes.text();

      const lineMatch = popText.match(/\$\('#cbo_line_no'\)\.val\('(\d+)'\)/);
      const floorMatch = popText.match(/\$\('#cbo_floor'\)\.val\('(\d+)'\)/);
      const dateMatch = popText.match(/\$\('#txt_issue_date'\)\.val\('([\d-]+)'\)/);

      const lineNo = lineMatch?.[1];
      const floorId = floorMatch?.[1];
      const issueDate = dateMatch?.[1];

      if (!lineNo || !floorId || !issueDate) {
        return respond({ error: "Failed to retrieve challan header data" }, 500);
      }

      // Step 3: Get bundle table data
      const finalPayload = `${barcodesString}**0**${system_id}**${company_id}**${lineNo}`;
      const updateRes = await erp.post(
        `${controllerUrl}?action=populate_bundle_data_update`,
        new URLSearchParams({ data: finalPayload }).toString(),
        { ...erp.headersCommon, "X-Requested-With": "XMLHttpRequest" }
      );
      const updateText = await updateRes.text();

      // Parse rows
      const trMatches = updateText.match(/<tr[^>]*id="tr_[^"]*"[^>]*>[\s\S]*?<\/tr>/gi) || [];
      const totalRows = trMatches.length;

      if (totalRows === 0) {
        return respond({ error: "No bundle rows found in challan" }, 404);
      }

      // Build delete payload
      const nowBD = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
      );
      const currTime = `${String(nowBD.getHours()).padStart(2, "0")}:${String(nowBD.getMinutes()).padStart(2, "0")}`;

      const deletePayload: Record<string, string> = {
        action: "save_update_delete",
        operation: "2", // 2 = DELETE
        tot_row: String(totalRows),
        garments_nature: "2",
        cbo_company_name: company_id,
        sewing_production_variable: "3",
        cbo_source: "1",
        cbo_emb_company: company_id,
        cbo_location: loc,
        cbo_floor: floorId,
        txt_issue_date: issueDate,
        txt_organic: "",
        txt_system_id: system_id,
        delivery_basis: "3",
        txt_challan_no: challan_no,
        cbo_line_no: lineNo,
        cbo_shift_name: "0",
        cbo_working_company_name: "0",
        cbo_working_location: "0",
        txt_remarks: "",
        txt_reporting_hour: currTime,
      };

      // Extract per-row data
      function rowVal(pat: RegExp, txt: string): string {
        const m = txt.match(pat);
        return m ? m[1] : "";
      }

      for (let i = 0; i < trMatches.length; i++) {
        const row = trMatches[i];
        const idx = i + 1;

        // Bundle number from td
        const bundleTd = row.match(/id="bundle_\d+"[^>]*>([^<]+)/);
        deletePayload[`bundleNo_${idx}`] = bundleTd ? bundleTd[1].trim() : "";

        // Barcode from title attribute
        const barcodeTd = row.match(/title="(\d+)"/);
        deletePayload[`barcodeNo_${idx}`] = barcodeTd ? barcodeTd[1] : "";

        // Hidden inputs
        const fields = [
          "orderId",
          "gmtsitemId",
          "countryId",
          "colorId",
          "sizeId",
          "colorSizeId",
          "qty",
          "dtlsId",
          "cutNo",
          "isRescan",
        ];

        for (const field of fields) {
          const val = rowVal(
            new RegExp(`name="${field}\\[\\]".*?value="([^"]*)"`, "i"),
            row
          );
          deletePayload[`${field}_${idx}`] = val;
        }
      }

      // Step 4: Execute delete
      const saveHeaders = {
        ...erp.headersCommon,
        Referer: `${erp.baseUrl}/production/bundle_wise_sewing_input.php?permission=1_1_1_1`,
      };

      const saveRes = await erp.post(
        controllerUrl,
        new URLSearchParams(deletePayload).toString(),
        saveHeaders
      );
      const respText = (await saveRes.text()).trim();

      // Parse response
      let resultMessage = "";
      let success = false;

      if (respText.startsWith("2")) {
        resultMessage = "Challan deleted successfully";
        success = true;
      } else if (respText.startsWith("0")) {
        resultMessage = "Data saved/inserted (unexpected for delete)";
        success = true;
      } else if (respText.startsWith("1") && !respText.startsWith("10") && !respText.startsWith("11") && !respText.startsWith("13")) {
        resultMessage = "Data updated (unexpected for delete)";
        success = true;
      } else if (respText.startsWith("10**")) {
        resultMessage = "Permission error - insufficient privileges";
      } else if (respText.startsWith("11")) {
        resultMessage = "Duplicate data detected";
      } else if (respText.startsWith("13")) {
        resultMessage = "Already forwarded to next process - cannot delete";
      } else {
        resultMessage = `Server response: ${respText.substring(0, 100)}`;
      }

      // Also remove from MongoDB if delete was successful
      if (success) {
        try {
          const { getDb } = await import("@/lib/mongodb");
          const db = await getDb();
          await db.collection("challans").deleteOne({
            challan_no: challan_no,
          });
        } catch {
          // DB cleanup failed silently - ERP delete already succeeded
        }
      }

      return respond({
        success,
        message: resultMessage,
        raw: respText.substring(0, 50),
      });
    }

    return respond({ error: "Invalid action. Use: search, preview, or delete" }, 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return respond({ error: msg }, 500);
  }
}
