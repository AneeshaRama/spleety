import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  devIndicators: false,
  experimental: {
    turbo: {
      root: __dirname,
    },
  },
};

export default nextConfig;
