import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {},
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "assets.vercel.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
    ],
  },
};

export default nextConfig;
