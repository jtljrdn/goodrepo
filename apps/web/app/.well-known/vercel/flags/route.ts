import { getProviderData } from "@flags-sdk/vercel"
import { createFlagsDiscoveryEndpoint } from "flags/next"
import { deepScan, improvementWorkflow } from "@/lib/flags"

export const GET = createFlagsDiscoveryEndpoint(async () => {
  return getProviderData({ deepScan, improvementWorkflow })
})
