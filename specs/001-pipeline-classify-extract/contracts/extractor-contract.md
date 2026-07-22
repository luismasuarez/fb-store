# Contract: Extractor Stage

## Input
```typescript
{
  text: string                    // raw post text
  classification: ClassificationResult  // from Classifier stage
  groupPurpose: string | null    // from Group config
}
```

## Output
```typescript
StructuredPropertyListing {
  listingType: "venta" | "alquiler" | "alquiler_temporario" | "compraventa"
  propertyType: "casa" | "apartamento" | "habitacion" | "local" | "terreno" | "oficina" | "otro"
  title: string
  descriptionClean: string
  summaryShort: string
  price: string
  location: { province?: string, municipality?: string, neighborhood?: string }
  propertyDetails: { bedrooms?: number, bathrooms?: number, totalArea?: string, floors?: number }
  features: string[]
  contact: { name?: string, phone?: string }
  confidenceScore: number
  // ...all existing fields from shared/src/ai/types.ts
}
```

## Behavior
- MUST use the configured extractor model (default: openai/gpt-4o)
- MUST validate output against Zod schema before returning
- IF validation fails: retry extraction once, then mark as "review" with error log
- IF extractor confidence < 0.3 AND classifier confidence > 0.5: mark as "review"
  (classifier/extractor disagreement — potential false positive)
