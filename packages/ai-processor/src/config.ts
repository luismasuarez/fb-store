import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export interface AiConfig {
  provider: string
  apiKey: string
  model: string
  batchSize: number
}

const CONFIG_PATH = resolve(process.env.PROFILE_DIR || "./profiles", "ai-config.json")

let cached: AiConfig | null = null

function loadFromFile(): AiConfig {
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, "utf-8")
      const json = JSON.parse(raw)
      return {
        provider: json.provider || "openrouter",
        apiKey: json.apiKey || process.env.OPENROUTER_API_KEY || "",
        model: json.model || process.env.AI_MODEL || "openai/gpt-4o-mini",
        batchSize: Number(json.batchSize) || Number(process.env.AI_BATCH_SIZE) || 10,
      }
    } catch {}
  }
  return {
    provider: process.env.AI_PROVIDER || "openrouter",
    apiKey: process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "openai/gpt-4o-mini",
    batchSize: Number(process.env.AI_BATCH_SIZE) || 10,
  }
}

export function getAiConfig(): AiConfig {
  if (!cached) cached = loadFromFile()
  return cached
}

export function reloadAiConfig(): AiConfig {
  cached = null
  return getAiConfig()
}
