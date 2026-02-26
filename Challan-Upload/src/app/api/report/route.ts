import { NextRequest, NextResponse } from "next/server";

/**
 * Report proxy — logs into ERP, fetches the report with session cookies,
 * inlines external JS (jquery + jquerybarcode) so barcode renders correctly,
 * and returns the complete HTML to the client.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.ERP_BASE_URL!;
  if (!url.startsWith(baseUrl)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 403 });
  }

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

  async function erpFetch(fetchUrl: string): Promise<Response> {
    return fetch(fetchUrl, {
      method: "GET",
      headers: {
        "User-Agent": clientUA,
        Cookie: getCookieHeader(),
        Referer: `${baseUrl}/production/bundle_wise_sewing_input.php?permission=1_1_2_1`,
      },
      redirect: "manual",
    });
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
    try {
      const menuRes = await erpFetch(
        `${baseUrl}/tools/valid_user_action.php?menuid=724`
      );
      parseCookies(menuRes);
    } catch {
      // Non-critical
    }

    // 3. Fetch the report HTML
    const reportRes = await erpFetch(url);
    const contentType =
      reportRes.headers.get("Content-Type") || "text/html";
    let bodyBuf = await reportRes.arrayBuffer();

    // 4. If HTML, inline external JS so barcode renders in the browser
    if (contentType.includes("text/html")) {
      let html = new TextDecoder().decode(bodyBuf);

      // Find all <script src="..."> tags with relative paths and inline them
      const scriptRegex =
        /<script[^>]+src="([^"]*?\.js)"[^>]*><\/script>/gi;
      let match: RegExpExecArray | null;
      const replacements: { original: string; jsUrl: string }[] = [];

      while ((match = scriptRegex.exec(html)) !== null) {
        const srcAttr = match[1];
        // Only process ERP scripts (relative paths like ../../js/...)
        if (
          srcAttr.startsWith("../../") ||
          srcAttr.startsWith("../") ||
          srcAttr.startsWith(baseUrl)
        ) {
          let absoluteUrl: string;
          if (srcAttr.startsWith("http")) {
            absoluteUrl = srcAttr;
          } else {
            // Resolve relative to the report URL directory
            const reportDir = url.substring(
              0,
              url.lastIndexOf("/") + 1
            );
            // Handle ../../ by resolving the URL
            absoluteUrl = new URL(srcAttr, reportDir).href;
          }
          replacements.push({ original: match[0], jsUrl: absoluteUrl });
        }
      }

      // Fetch each JS file and inline it
      for (const rep of replacements) {
        try {
          const jsRes = await erpFetch(rep.jsUrl);
          if (jsRes.ok) {
            const jsCode = await jsRes.text();
            html = html.replace(
              rep.original,
              `<script type="text/javascript">\n${jsCode}\n</script>`
            );
          }
        } catch {
          // If a JS file fails to load, leave the original tag
        }
      }

      // Remove chrome-extension scripts that pollute the HTML
      html = html.replace(
        /<script[^>]*chrome-extension:\/\/[^>]*>[\s\S]*?<\/script>/gi,
        ""
      );

      bodyBuf = new TextEncoder().encode(html).buffer;
    }

    return new NextResponse(bodyBuf, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
