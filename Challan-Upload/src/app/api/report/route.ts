import { NextRequest, NextResponse } from "next/server";

/**
 * Report proxy — logs into ERP, fetches report with session cookies,
 * and streams the response back so the user doesn't need ERP login.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate URL is from our ERP
  const allowedBase = process.env.ERP_BASE_URL!;
  if (!url.startsWith(allowedBase)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 403 });
  }

  const baseUrl = allowedBase;
  const erpOrigin = new URL(baseUrl).origin;
  const clientUA =
    request.headers.get("User-Agent") ||
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36";

  const headersCommon: Record<string, string> = {
    "User-Agent": clientUA,
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: erpOrigin + "/",
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

  try {
    // 1. Login
    const loginBody = new URLSearchParams({
      txt_userid: process.env.ERP_USERNAME!,
      txt_password: process.env.ERP_PASSWORD!,
      submit: "Login",
    }).toString();

    const loginRes = await fetch(`${baseUrl}/login.php`, {
      method: "POST",
      headers: headersCommon,
      body: loginBody,
      redirect: "manual",
    });
    parseCookies(loginRes);

    // 2. Session activate
    const headersMenu = { ...headersCommon };
    headersMenu["Referer"] =
      `${baseUrl}/production/bundle_wise_sewing_input.php?permission=1_1_2_1`;
    try {
      const menuRes = await fetch(
        `${baseUrl}/tools/valid_user_action.php?menuid=724`,
        {
          method: "GET",
          headers: { ...headersMenu, Cookie: getCookieHeader() },
          redirect: "manual",
        }
      );
      parseCookies(menuRes);
    } catch {
      // Non-critical
    }

    // 3. Fetch the report
    const reportRes = await fetch(url, {
      method: "GET",
      headers: {
        ...headersCommon,
        Cookie: getCookieHeader(),
        Referer: `${baseUrl}/production/bundle_wise_sewing_input.php?permission=1_1_2_1`,
      },
      redirect: "manual",
    });

    const contentType = reportRes.headers.get("Content-Type") || "text/html";
    let bodyBuf = await reportRes.arrayBuffer();

    // If HTML, rewrite relative script/image src paths to absolute ERP URLs
    // so barcode JS and other assets load correctly in the browser
    if (contentType.includes("text/html")) {
      let html = new TextDecoder().decode(bodyBuf);
      // Rewrite src="../../js/..." → absolute ERP URL
      html = html.replace(
        /src="(\.\.\/)+/g,
        `src="${baseUrl}/`
      );
      // Also rewrite any href="../../..." for CSS etc.
      html = html.replace(
        /href="(\.\.\/)+/g,
        `href="${baseUrl}/`
      );
      bodyBuf = new TextEncoder().encode(html).buffer;
    }

    return new NextResponse(bodyBuf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
