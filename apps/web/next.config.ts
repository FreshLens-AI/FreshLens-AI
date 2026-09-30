import path from "node:path";
import type { NextConfig } from "next";

/**
 * Public clients (mobile + same-origin browser) call this Next app.
 * Server-side admin fetches should prefer API_UPSTREAM_URL (see client.ts)
 * so they do not loop through the rewrite.
 */
function upstreamOrigin(): string {
  const raw =
    process.env.API_UPSTREAM_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:8000";
  return raw.replace(/\/$/, "");
}

const upstream = upstreamOrigin();

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${upstream}/api/v1/:path*`,
      },
      {
        source: "/health",
        destination: `${upstream}/health`,
      },
      {
        source: "/openapi.json",
        destination: `${upstream}/openapi.json`,
      },
    ];
  },
};

export default nextConfig;
