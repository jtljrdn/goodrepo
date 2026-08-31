import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  // Required by the "use cache" directive in lib/scan.ts, which caches a whole
  // scan against its commit SHA.
  cacheComponents: true,
}

export default nextConfig
