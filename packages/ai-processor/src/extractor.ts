import { getProvider } from "@fb-store/shared";
import type { StructuredPropertyListing } from "@fb-store/shared";

export interface Extractor {
  extract(text: string): Promise<StructuredPropertyListing>;
}

export function createExtractor(providerName: string, apiKey: string, model: string): Extractor {
  const provider = getProvider(providerName, apiKey, model);

  return {
    async extract(text: string): Promise<StructuredPropertyListing> {
      return provider.extract(text);
    },
  };
}
