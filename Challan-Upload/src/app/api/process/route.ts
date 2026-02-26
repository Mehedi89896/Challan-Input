import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// --- BACKEND LOGIC (Converted from Python) ---

async function processData(
  userInput: string,
  clientUA: string,
  companyId: string
) {
  const baseUrl = process.env.ERP_BASE_URL!;
  const erpOrigin = new URL(baseUrl).origin;

  const headersCommon: Record<string, string> = {
    "User-Agent":
      clientUA ||
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: erpOrigin + "/",
    Referer: `${baseUrl}/login.php`,
  };

  // Cookie jar simulation - we'll track cookies manually
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
    headers: Record<string, string>,
    retries = 3
  ): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { ...headers, Cookie: getCookieHeader() },
          body,
          redirect: "manual",
        });
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
    headers: Record<string, string>,
    retries = 3
  ): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { ...headers, Cookie: getCookieHeader() },
          redirect: "manual",
        });
        parseCookies(res);
        return res;
      } catch {
        if (i === retries - 1) throw new Error(`Failed after ${retries} retries: ${url}`);
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw new Error("Unreachable");
  }

  try {
    // 1. Login
    const loginBody = new URLSearchParams({
      txt_userid: process.env.ERP_USERNAME!,
      txt_password: process.env.ERP_PASSWORD!,
      submit: "Login",
    }).toString();

    await sessionPost(`${baseUrl}/login.php`, loginBody, headersCommon);

    // 2. Session Activate
    const headersMenu = { ...headersCommon };
    headersMenu["Referer"] = `${baseUrl}/production/bundle_wise_sewing_input.php?permission=1_1_2_1`;
    try {
      await sessionGet(`${baseUrl}/tools/valid_user_action.php?menuid=724`, headersMenu);
      await sessionGet(
        `${baseUrl}/includes/common_functions_for_js.php?data=724_7_406&action=create_menu_session`,
        headersMenu
      );
    } catch {
      // pass - same as Python
    }

    // 3. Logic Setup
    const cboLogic = String(companyId);

    const ctrlUrl = `${baseUrl}/production/requires/bundle_wise_cutting_delevar_to_input_controller.php`;
    const { "Content-Type": _, ...headersWithoutCT } = headersCommon;
    const headersAjax = { ...headersWithoutCT, "X-Requested-With": "XMLHttpRequest" };
    void _;

    // 4. Search and Get Popup Data
    const searchRes = await sessionGet(
      `${ctrlUrl}?data=${userInput}_0__${cboLogic}_2__1_&action=create_challan_search_list_view`,
      headersAjax
    );
    const searchText = await searchRes.text();

    const midMatch = searchText.match(/js_set_value\((\d+)\)/);
    if (!midMatch) {
      return { status: "error", message: "Invalid Challan / No Data" };
    }
    const sysId = midMatch[1];

    const resPopBody = new URLSearchParams({
      rndval: String(Date.now()),
    }).toString();
    const resPop = await sessionPost(
      `${ctrlUrl}?data=${sysId}&action=populate_data_from_challan_popup`,
      resPopBody,
      headersCommon
    );
    const popText = await resPop.text();

    function getVal(idName: string, text: string): string {
      const escaped = idName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(escaped + /.*?\.val\(\s*['"]?([^'")\s]+)['"]?\s*\)/.source);
      const m = text.match(pattern);
      return m ? m[1].trim() : "0";
    }

    const source = getVal("cbo_source", popText);
    const embCompany = getVal("cbo_emb_company", popText);
    const line = getVal("cbo_line_no", popText);
    const location = getVal("cbo_location", popText);
    const floor = getVal("cbo_floor", popText);

    // Validation
    const forbidden = ["0", "00", "", "undefined", "null"];
    const missingFields: string[] = [];
    if (forbidden.includes(source)) missingFields.push("Source");
    if (forbidden.includes(embCompany)) missingFields.push("Emb Company");
    if (forbidden.includes(line)) missingFields.push("Line No");
    if (forbidden.includes(location)) missingFields.push("Location");

    if (missingFields.length > 0) {
      return {
        status: "error",
        message: `Missing/Zero: ${missingFields.join(", ")}`,
      };
    }

    // Bundles Extraction
    const resBun = await sessionGet(
      `${ctrlUrl}?data=${sysId}&action=bundle_nos`,
      headersAjax
    );
    const bunText = await resBun.text();
    const rawBun = bunText.split("**")[0];
    if (!rawBun) {
      return { status: "error", message: "Empty Bundle List" };
    }

    const resTbl = await sessionGet(
      `${ctrlUrl}?data=${rawBun}**0**${sysId}**${cboLogic}**${line}&action=populate_bundle_data_update`,
      headersAjax
    );
    const tblText = await resTbl.text();
    const rows = tblText.split("<tr");

    interface BundleData {
      barcodeNo: string;
      bundleNo: string;
      orderId: string;
      gmtsitemId: string;
      countryId: string;
      colorId: string;
      sizeId: string;
      colorSizeId: string;
      qty: string;
      dtlsId: string;
      cutNo: string;
      isRescan: string;
    }

    const bData: BundleData[] = [];

    function getRowVal(pat: RegExp, txt: string): string {
      const m = txt.match(pat);
      return m ? m[1] : "0";
    }

    for (const r of rows) {
      if (!r.includes('id="tr_')) continue;
      bData.push({
        barcodeNo: getRowVal(/title="(\d+)"/, r),
        bundleNo: getRowVal(/id="bundle_\d+"[^>]*>([^<]+)/, r),
        orderId: getRowVal(/name="orderId\[\]".*?value="(\d+)"/, r),
        gmtsitemId: getRowVal(/name="gmtsitemId\[\]".*?value="(\d+)"/, r),
        countryId: getRowVal(/name="countryId\[\]".*?value="(\d+)"/, r),
        colorId: getRowVal(/name="colorId\[\]".*?value="(\d+)"/, r),
        sizeId: getRowVal(/name="sizeId\[\]".*?value="(\d+)"/, r),
        colorSizeId: getRowVal(/name="colorSizeId\[\]".*?value="(\d+)"/, r),
        qty: getRowVal(/name="qty\[\]".*?value="(\d+)"/, r),
        dtlsId: getRowVal(/name="dtlsId\[\]".*?value="(\d+)"/, r),
        cutNo: getRowVal(/name="cutNo\[\]".*?value="([^"]+)"/, r),
        isRescan: getRowVal(/name="isRescan\[\]".*?value="(\d+)"/, r),
      });
    }

    // 5. Save Payload
    const nowBD = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
    );

    // If today is Friday (getDay() === 5), use yesterday's date
    let saveDate = nowBD;
    if (nowBD.getDay() === 5) {
      // Friday = 5
      saveDate = new Date(nowBD.getTime() - 24 * 60 * 60 * 1000);
    }

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const fmtDate = `${String(saveDate.getDate()).padStart(2, "0")}-${months[saveDate.getMonth()]}-${saveDate.getFullYear()}`;
    const currTime = `${String(nowBD.getHours()).padStart(2, "0")}:${String(nowBD.getMinutes()).padStart(2, "0")}`;

    const payload: Record<string, string> = {
      action: "save_update_delete",
      operation: "0",
      tot_row: String(bData.length),
      garments_nature: "'2'",
      cbo_company_name: `'${cboLogic}'`,
      sewing_production_variable: "'3'",
      cbo_source: `'${source}'`,
      cbo_emb_company: `'${embCompany}'`,
      cbo_location: `'${location}'`,
      cbo_floor: `'${floor}'`,
      txt_issue_date: `'${fmtDate}'`,
      txt_organic: "''",
      txt_system_id: "''",
      delivery_basis: "'3'",
      txt_challan_no: "''",
      cbo_line_no: `'${line}'`,
      cbo_shift_name: "'0'",
      cbo_working_company_name: "'0'",
      cbo_working_location: "'0'",
      txt_remarks: "''",
      txt_reporting_hour: `'${currTime}'`,
    };

    for (let i = 0; i < bData.length; i++) {
      const idx = i + 1;
      const b = bData[i];
      payload[`bundleNo_${idx}`] = b.bundleNo;
      payload[`orderId_${idx}`] = b.orderId;
      payload[`gmtsitemId_${idx}`] = b.gmtsitemId;
      payload[`countryId_${idx}`] = b.countryId;
      payload[`colorId_${idx}`] = b.colorId;
      payload[`sizeId_${idx}`] = b.sizeId;
      payload[`inseamId_${idx}`] = "0";
      payload[`colorSizeId_${idx}`] = b.colorSizeId;
      payload[`qty_${idx}`] = b.qty;
      payload[`dtlsId_${idx}`] = b.dtlsId;
      payload[`cutNo_${idx}`] = b.cutNo;
      payload[`isRescan_${idx}`] = b.isRescan;
      payload[`barcodeNo_${idx}`] = b.barcodeNo;
      payload[`cutMstIdNo_${idx}`] = "0";
      payload[`cutNumPrefixNo_${idx}`] = "0";
    }

    const headersSave = { ...headersCommon };
    headersSave["Referer"] =
      `${baseUrl}/production/bundle_wise_sewing_input.php?permission=1_1_2_1`;

    const saveBody = new URLSearchParams(payload).toString();
    const saveRes = await sessionPost(
      `${baseUrl}/production/requires/bundle_wise_sewing_input_controller.php`,
      saveBody,
      headersSave
    );
    const saveText = await saveRes.text();

    if (saveText.includes("**")) {
      const parts = saveText.split("**");
      const code = parts[0].trim();

      if (code === "0") {
        const newSysId = parts[1];
        const newChallan = parts.length > 2 ? parts[2] : "Sewing Challan";
        const u1 = `${baseUrl}/production/requires/bundle_wise_sewing_input_controller.php?data=1*${newSysId}*3*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*1*undefined*undefined*undefined&action=emblishment_issue_print_13`;
        const u2 = `${baseUrl}/production/requires/bundle_wise_sewing_input_controller.php?data=1*${newSysId}*3*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*undefined*undefined*undefined*1&action=sewing_input_challan_print_5`;

        // Company name mapping
        const companyNames: Record<string, string> = {
          "1": "Cotton Club BD",
          "2": "Cotton Clothing",
          "3": "Tropical Knitex",
          "4": "Cotton Clout BD",
        };

        // Fire-and-forget: fetch report + save to DB in background
        // so the user gets an immediate response
        (async () => {
          let bookingNo = "";
          let lineNo = line;
          let color = "";
          const challanDate = fmtDate;
          let totalQty = bData.reduce((sum, b) => sum + (parseInt(b.qty, 10) || 0), 0);

          try {
            const printRes = await sessionGet(u2, {
              ...headersCommon,
              Referer: `${baseUrl}/production/bundle_wise_sewing_input.php?permission=1_1_2_1`,
            });
            const html = await printRes.text();

            // Line: <strong>Line </strong></td><td>: 31</td>
            const lineMatch = html.match(/<strong>\s*Line\s*<\/strong>\s*<\/td>\s*<td[^>]*>\s*:\s*([^<]+)/i);
            if (lineMatch) lineNo = lineMatch[1].trim();

            // Color: last <td> before first <td ... width="50"> in data rows
            const colorMatch = html.match(/<td[^>]*>([^<]{2,})<\/td>\s*<td[^>]*width="50"/i);
            if (colorMatch) {
              const val = colorMatch[1].trim();
              // Avoid matching pure numbers (size values)
              if (val && !/^\d+$/.test(val)) color = val;
            }

            // Total Qty: first <td align="center"> with only digits after Grand Total
            const gtIdx = html.indexOf("Grand Total");
            if (gtIdx !== -1) {
              const afterGt = html.substring(gtIdx);
              // Skip all width="50" tds (sizes), then capture the next number
              const qtyMatch = afterGt.match(
                /(?:<td[^>]*width="50"[^>]*>[^<]*<\/td>\s*)+<td[^>]*>(\d+)<\/td>/i
              );
              if (qtyMatch) totalQty = parseInt(qtyMatch[1], 10) || totalQty;
            }

            // Booking No: "Internal Ref" column (5th td in data row)
            // HTML: SL(1), Buyer(2), Job No(3), Style Ref(4), Internal Ref(5)
            // Value may be wrapped in <p> tags: <td><p>1500/315 B</p></td>
            const dataRowMatch = html.match(
              /<tbody>\s*<tr[^>]*>\s*(?:<td[^>]*>[\s\S]*?<\/td>\s*){4}<td[^>]*>([\s\S]*?)<\/td>/i
            );
            if (dataRowMatch) {
              bookingNo = dataRowMatch[1].replace(/<[^>]*>/g, "").trim();
            }
          } catch {
            // Report fetch failed — save with fallback data
          }

          try {
            const db = await getDb();
            await db.collection("challans").insertOne({
              challan_no: newChallan,
              system_id: newSysId,
              company_id: cboLogic,
              company_name: companyNames[cboLogic] || cboLogic,
              booking_no: bookingNo,
              line_no: lineNo,
              color,
              date: challanDate,
              total_quantity: totalQty,
              report1_url: u1,
              report2_url: u2,
              created_at: new Date(),
            });
          } catch {
            // DB save failed silently
          }
        })();

        return {
          status: "success",
          challan_no: newChallan,
          system_id: newSysId,
          report1_url: u1,
          report2_url: u2,
        };
      } else if (code === "20") {
        return { status: "error", message: "Bundle Already Scanned!" };
      } else if (code === "10") {
        return { status: "error", message: "Validation Error (10)." };
      } else {
        return { status: "error", message: `Server Error Code: ${code}` };
      }
    }

    return { status: "error", message: `Save Failed: ${saveRes.status}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "error", message: msg };
  }
}

// --- API ROUTE ---
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data || !data.challan || !data.company_id) {
      return NextResponse.json({
        status: "error",
        message: "Missing Data",
      });
    }

    const clientUA = request.headers.get("User-Agent") || "";
    const result = await processData(data.challan, clientUA, data.company_id);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      status: "error",
      message: "Server Error",
    });
  }
}
