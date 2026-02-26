import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Global security headers applied to every response.
   * Defence-in-depth: even if application code has a gap,
   * the browser enforces these restrictions.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Disable XSS auto-detection (rely on CSP instead)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Don't send referrer to external sites
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict what the page can load
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // needed for Next.js
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self'",
              "frame-ancestors 'self'",
              "form-action 'self'",
              "base-uri 'self'",
            ].join("; "),
          },
          // Opt out of browser features we don't use
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
          // Prevent DNS prefetch abuse
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      {
        // API routes get stricter cache + CORS headers
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
