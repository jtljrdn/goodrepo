import type { NextConfig } from "next"
import createWithVercelToolbar from "@vercel/toolbar/plugins/next"

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

const withVercelToolbar = createWithVercelToolbar()

export default withVercelToolbar(nextConfig)
