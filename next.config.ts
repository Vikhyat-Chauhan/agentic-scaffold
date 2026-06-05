import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  eslint: {
    // Don't block production builds on lint during the sprint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
