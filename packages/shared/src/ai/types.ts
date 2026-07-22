export interface ClassificationResult {
  contentType: "inmuebles" | "rejected"
  confidence: number
  reasoning: string
  detectedEntities: string[]
}

export interface ContentExtractor {
  readonly contentType: string
  readonly systemPrompt: string
  readonly schema: any
  classify(text: string): Promise<ClassificationResult>
  extract(text: string): Promise<StructuredPropertyListing>
}

export interface StructuredPropertyListing {
  listingType: "venta" | "alquiler" | "alquiler_temporario" | "compraventa"
  propertyType: "casa" | "apartamento" | "habitacion" | "local" | "terreno" | "oficina" | "otro"
  title: string
  descriptionClean: string
  summaryShort: string
  price: string
  location: {
    province?: string
    municipality?: string
    neighborhood?: string
  }
  propertyDetails: {
    bedrooms?: number
    bathrooms?: number
    totalArea?: string
    floors?: number
  }
  features: string[]
  includedItems: string[]
  services: string[]
  securityFeatures: string[]
  contact: {
    name?: string
    phone?: string
  }
  media: {
    images: string[]
  }
  sellerNotes: string
  missingInformation: string[]
  confidenceScore: number
  rawEntitiesDetected: string[]
}
