import { expect, test } from "bun:test"
import {
  maskLangfuseData,
  redactGenAiSpanAttributes,
} from "./langfuse-mask"

test("masks common secrets in traced repository content", () => {
  const input = [
    "API_KEY=secret-value",
    "Authorization: Bearer-token",
    "GITHUB_TOKEN=github_pat_1234567890abcdefghijklmnop",
    "DATABASE_URL=postgresql://user:password@database.example/db",
    "sk-lf-abcdefghijklmnopqrstuvwxyz",
    "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
  ].join("\n")

  const masked = maskLangfuseData({ data: input })

  expect(masked).not.toContain("secret-value")
  expect(masked).not.toContain("Bearer-token")
  expect(masked).not.toContain("github_pat_")
  expect(masked).not.toContain(":password@")
  expect(masked).not.toContain("sk-lf-")
  expect(masked).not.toContain("BEGIN PRIVATE KEY")
})

test("masks secrets nested in structured telemetry", () => {
  const input = {
    repository: "langfuse/langfuse",
    messages: [{ content: "API_KEY=secret-value" }],
  }

  expect(maskLangfuseData({ data: input })).toEqual({
    repository: "langfuse/langfuse",
    messages: [{ content: "API_KEY=[REDACTED]" }],
  })
})

test("masks quoted JSON credential keys and complete quoted values", () => {
  const input = JSON.stringify({
    apiKey: "json-secret",
    nested: { token: "secret value with spaces" },
    safe: "visible",
  })

  expect(maskLangfuseData({ data: input })).toBe(
    JSON.stringify({
      apiKey: "[REDACTED]",
      nested: { token: "[REDACTED]" },
      safe: "visible",
    })
  )
  expect(
    maskLangfuseData({ data: 'const API_KEY = "secret value with spaces"' })
  ).toBe("const API_KEY = [REDACTED]")
})

test("redacts AI SDK OpenTelemetry message and tool attributes", () => {
  const attributes: Record<string, unknown> = {
    "gen_ai.input.messages":
      '[{"content":"{\\"token\\":\\"secret value with spaces\\"}"}]',
    "gen_ai.tool.call.result": "PASSWORD=another-secret",
    "gen_ai.request.model": "anthropic/claude-sonnet-5",
  }

  redactGenAiSpanAttributes(attributes)

  expect(attributes).toEqual({
    "gen_ai.input.messages": '[{"content":"{\\"token\\":\\"[REDACTED]\\"}"}]',
    "gen_ai.tool.call.result": "PASSWORD=[REDACTED]",
    "gen_ai.request.model": "anthropic/claude-sonnet-5",
  })
})
