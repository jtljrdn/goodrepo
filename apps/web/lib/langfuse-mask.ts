const PRIVATE_KEY =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
const KNOWN_TOKEN =
  /\b(?:github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]{20,}|(?:sk|pk)-lf-[A-Za-z0-9_-]+|sk-(?:proj-)?[A-Za-z0-9_-]{20,})\b/g
const CREDENTIAL_VALUE =
  /((?:api[_-]?key|access[_-]?token|auth(?:orization)?|client[_-]?secret|password|passwd|secret|token)\s*[=:]\s*["']?)([^\s"',;}\]]+)/gi
const URL_PASSWORD = /([a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:)[^@\s/]+@/gi

const GEN_AI_DATA_ATTRIBUTES = [
  "gen_ai.input.messages",
  "gen_ai.output.messages",
  "gen_ai.system_instructions",
  "gen_ai.tool.call.arguments",
  "gen_ai.tool.call.result",
  "gen_ai.tool.definitions",
] as const

function maskValue(data: unknown): unknown {
  if (typeof data === "string") {
    return data
      .replace(PRIVATE_KEY, "[REDACTED PRIVATE KEY]")
      .replace(KNOWN_TOKEN, "[REDACTED TOKEN]")
      .replace(CREDENTIAL_VALUE, "$1[REDACTED]")
      .replace(URL_PASSWORD, "$1[REDACTED]@")
  }
  if (Array.isArray(data)) return data.map(maskValue)
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, maskValue(value)])
    )
  }
  return data
}

export function maskLangfuseData({ data }: { data: unknown }): unknown {
  return maskValue(data)
}

export function redactGenAiSpanAttributes(
  attributes: Record<string, unknown>
): void {
  for (const key of GEN_AI_DATA_ATTRIBUTES) {
    if (!(key in attributes)) continue
    attributes[key] = maskValue(attributes[key])
  }
}
