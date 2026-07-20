import type { StructuredPropertyListing } from "./types"
import { getSystemPrompt, getUserPrompt } from "./registry"

const TIMEOUT_MS = 30_000
const MAX_RETRIES = 2

export interface OpenRouterConfig {
  apiKey: string
  model: string
}

export async function extractWithOpenRouter(
  text: string,
  config: OpenRouterConfig,
): Promise<StructuredPropertyListing> {
  const truncated = text.length > 8000 ? text.slice(0, 8000) : text
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 2000))
    try {
      return await callOpenRouter(truncated, config)
    } catch (err: any) {
      lastError = err
    }
  }

  throw lastError ?? new Error("OpenRouter extraction failed")
}

async function callOpenRouter(
  text: string,
  config: OpenRouterConfig,
): Promise<StructuredPropertyListing> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://fbstore.app",
        "X-OpenRouter-Title": "FB Store",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: getSystemPrompt() },
          { role: "user", content: getUserPrompt(text) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content
    if (!content) throw new Error("Empty response from OpenRouter")

    return JSON.parse(content) as StructuredPropertyListing
  } finally {
    clearTimeout(timer)
  }
}
