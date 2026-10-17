import type { NextConfig } from "next";

/** Hosts planetary imagery may load from (kept in sync with IMAGE_HOSTS in src/providers/planetary-imagery/types.ts). */
const IMAGERY_HOSTS = ["mars.nasa.gov", "images-assets.nasa.gov"];

const nextConfig: NextConfig = {
  images: { remotePatterns: IMAGERY_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname })) },
  // Server-only packages that must not be bundled.
  serverExternalPackages: ["pg", "@electric-sql/pglite", "web-push"],
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Service-Worker-Allowed", value: "/" }, { key: "Cache-Control", value: "no-cache" }] },
      // SKY hosts the imagery gallery: images may only come from this origin and the allowlisted NASA hosts.
      { source: "/sky", headers: [{ key: "Content-Security-Policy", value: `img-src 'self' data: blob: ${IMAGERY_HOSTS.map((h) => `https://${h}`).join(" ")}` }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
