import { Hono } from "hono"
import type { Context } from "hono"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { Extractor } from "@fb-store/shared"

interface AiConfigData {
  provider: string
  model: string
  apiKey?: string
  apiKeyMasked?: string
}

function getConfigPath(): string {
  return resolve(process.env.PROFILE_DIR || "./profiles", "ai-config.json")
}

function loadConfig(): AiConfigData | null {
  const path = getConfigPath()
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    return null
  }
}

function saveConfig(data: { provider: string; model: string; apiKey: string }): void {
  const path = getConfigPath()
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8")
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••"
  return key.slice(0, 6) + "••••" + key.slice(-4)
}

const aiRoute = new Hono()

aiRoute.get("/ai/config", async (c: Context<{ Variables: { requestId: string } }>) => {
  const config = loadConfig() ?? {
    provider: process.env.AI_PROVIDER || "openrouter",
    model: process.env.AI_MODEL || "openai/gpt-4o-mini",
    apiKey: "",
  }

  return c.json({
    data: {
      provider: config.provider,
      model: config.model,
      apiKeyMasked: config.apiKey ? maskKey(config.apiKey) : "",
    },
  })
})

aiRoute.put("/ai/config", async (c: Context<{ Variables: { requestId: string } }>) => {
  const body = await c.req.json()
  const { provider, model, apiKey } = body

  if (!provider) {
    return c.json({ error: { code: "validation", message: "provider is required", requestId: c.get("requestId") } }, 400)
  }
  if (!apiKey) {
    return c.json({ error: { code: "validation", message: "apiKey is required", requestId: c.get("requestId") } }, 400)
  }

  saveConfig({
    provider,
    model: model || "openai/gpt-4o-mini",
    apiKey,
  })

  const config = loadConfig()!
  return c.json({
    data: {
      provider: config.provider,
      model: config.model,
      apiKeyMasked: maskKey(apiKey),
    },
  })
})

aiRoute.post("/ai/test", async (c: Context<{ Variables: { requestId: string } }>) => {
  const config = loadConfig()
  if (!config || !config.apiKey) {
    return c.json({ error: { code: "business", message: "AI not configured", requestId: c.get("requestId") } }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const testText = body.text || "Se vende casa en Centro Habana, 3 cuartos, 2 banos, 100 m2, 25000 CUP. Contactar al 55551234."

  try {
    const start = Date.now()
    const extractor = new Extractor(config.provider, config.apiKey, config.model)
    const result = await extractor.extract(testText)
    const duration = Date.now() - start

    return c.json({
      data: {
        success: true,
        durationMs: duration,
        result: {
          title: result.title,
          price: result.price,
          confidenceScore: result.confidenceScore,
          listingType: result.listingType,
          propertyType: result.propertyType,
        },
      },
    })
  } catch (err: any) {
    return c.json({
      data: {
        success: false,
        error: err.message,
      },
    })
  }
})

aiRoute.post("/ai/process", async (c: Context<{ Variables: { requestId: string } }>) => {
  const { processBatch } = await import("@fb-store/ai-processor")
  try {
    const result = await processBatch()
    return c.json({ data: result })
  } catch (err: any) {
    return c.json({ error: { code: "unknown", message: err.message, requestId: c.get("requestId") } }, 500)
  }
})

export default aiRoute
