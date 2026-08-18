import type { NextConfig } from "next";

// Covers are served from Supabase Storage; the project host varies per environment, so it is
// derived from SUPABASE_URL at build time rather than hardcoded.
const supabaseHost = (() => {
  try {
    return process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

const remotePatterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
  // Steam cover art, used until steam-sync mirrors it into Supabase.
  { protocol: "https", hostname: "cdn.cloudflare.steamstatic.com" },
  { protocol: "https", hostname: "cdn2.steamgriddb.com" },
  { protocol: "https", hostname: "cdn.steamgriddb.com" },
];

if (supabaseHost) {
  remotePatterns.unshift({
    protocol: "https",
    hostname: supabaseHost,
    pathname: "/storage/v1/object/public/**",
  });
}

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    // Explicit allowlist. A wildcard host turns /_next/image into an open image proxy that
    // anyone can point at any URL — and that route is not behind the auth middleware.
    remotePatterns,
    formats: ["image/avif", "image/webp"],
    // Cover art is immutable once mirrored; the 60s default re-transforms it constantly.
    minimumCacheTTL: 31_536_000,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
