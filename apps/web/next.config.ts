import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  cacheComponents: true,
  async redirects() {
    return [
      {
        source: "/api/auth/callback/github",
        has: [{ type: "query", key: "installation_id" }],
        missing: [{ type: "query", key: "state" }],
        destination: "/",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
