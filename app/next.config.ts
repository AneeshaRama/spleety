import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    turbo: {
      root: __dirname,
    },
  },
};

export default nextConfig;
