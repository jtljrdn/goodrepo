import { LangfuseSpanProcessor } from "@langfuse/otel"
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk"
import { registerOTel, type Configuration } from "@vercel/otel"
import { registerTelemetry } from "ai"

import {
  maskLangfuseData,
  redactGenAiSpanAttributes,
} from "@/lib/langfuse-mask"

type SpanProcessor = Exclude<
  NonNullable<Configuration["spanProcessors"]>[number],
  "auto"
>

function withGenAiRedaction(processor: LangfuseSpanProcessor): SpanProcessor {
  return {
    onStart(span, context) {
      processor.onStart(span, context)
    },
    onEnd(span) {
      const attributes = { ...span.attributes }
      redactGenAiSpanAttributes(attributes)
      const redactedSpan = new Proxy(span, {
        get(target, property) {
          if (property === "attributes") return attributes
          const value = Reflect.get(target, property, target)
          return typeof value === "function" ? value.bind(target) : value
        },
      })
      processor.onEnd(redactedSpan)
    },
    forceFlush: () => processor.forceFlush(),
    shutdown: () => processor.shutdown(),
  }
}

let spanProcessor: LangfuseSpanProcessor | undefined

export function registerLangfuse() {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY
  const baseUrl = process.env.LANGFUSE_BASE_URL

  if (!publicKey && !secretKey && !baseUrl) return
  if (!publicKey || !secretKey || !baseUrl) {
    console.warn(
      "Langfuse tracing is disabled because LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_BASE_URL must all be set."
    )
    return
  }

  spanProcessor = new LangfuseSpanProcessor({
    publicKey,
    secretKey,
    baseUrl,
    environment:
      process.env.LANGFUSE_TRACING_ENVIRONMENT ??
      process.env.VERCEL_ENV ??
      "development",
    release:
      process.env.LANGFUSE_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    exportMode: "immediate",
    mask: maskLangfuseData,
  })

  registerOTel({
    serviceName: "goodrepo-web",
    spanProcessors: [withGenAiRedaction(spanProcessor)],
  })
  registerTelemetry(new LangfuseVercelAiSdkIntegration())
}

export async function flushLangfuse() {
  try {
    await spanProcessor?.forceFlush()
  } catch (error) {
    console.error("Failed to flush Langfuse traces", error)
  }
}
