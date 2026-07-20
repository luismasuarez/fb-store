import { getProvider, type AIProvider } from "./provider"
import type { StructuredPropertyListing } from "./types"

export type { StructuredPropertyListing } from "./types"

export class Extractor {
  private provider: AIProvider

  constructor(providerName: string, apiKey: string, model: string) {
    this.provider = getProvider(providerName, apiKey, model)
  }

  async extract(text: string): Promise<StructuredPropertyListing> {
    return this.provider.extract(text)
  }
}
