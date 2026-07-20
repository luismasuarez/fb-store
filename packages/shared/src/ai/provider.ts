import { extractWithOpenRouter, type OpenRouterConfig } from "./openrouter"
import type { StructuredPropertyListing } from "./types"

export interface AIProvider {
  extract(text: string): Promise<StructuredPropertyListing>
}

export function getProvider(providerName: string, apiKey: string, model: string): AIProvider {
  switch (providerName) {
    case "openrouter":
      return {
        extract: (text: string) =>
          extractWithOpenRouter(text, { apiKey, model }),
      }
    default:
      throw new Error(`Unknown AI provider: ${providerName}`)
  }
}
