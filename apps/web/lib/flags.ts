import { vercelAdapter } from "@flags-sdk/vercel"
import { flag } from "flags/next"

export const DEEP_SCAN_ENABLED = process.env.GOODREPO_DEEP_SCAN === "1"

export const deepScan = flag<boolean>({
  key: "deep-scan",
  description: "whether or not deep scans are enabled",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
  adapter: vercelAdapter,
})

export const improvementWorkflow = flag<boolean>({
  key: "improvement-workflow",
  description: "controls whether the improvement workflow is enabled or not",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
  adapter: vercelAdapter,
})
