import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow production checks without overwriting the active development build.
  distDir: process.env.NEXT_BUILD_DIR ?? ".next",
  devIndicators: false,
  experimental: {
    // The market loader owns the cache; avoid a second raw-response HMR cache.
    serverComponentsHmrCache: false,
  },
};

export default nextConfig;
