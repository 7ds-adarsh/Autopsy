import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // Type checks are verified independently via `npx tsc --noEmit` in CI/test pipelines.
  // Skipping Next's in-process type check avoids Node worker heap exhaustion on Windows.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
