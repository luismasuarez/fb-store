import { describe, it, expect, beforeEach } from "vitest"
import { ExtractorRegistry } from "../ai/registry"
import type { ContentExtractor, ClassificationResult, StructuredPropertyListing } from "../ai/types"

class MockExtractor implements ContentExtractor {
  readonly contentType: string
  readonly systemPrompt = "mock prompt"

  constructor(type: string) {
    this.contentType = type
  }

  async classify(_text: string): Promise<ClassificationResult> {
    return { contentType: "inmuebles", confidence: 0.9, reasoning: "mock", detectedEntities: [] }
  }

  async extract(_text: string): Promise<StructuredPropertyListing> {
    return {} as StructuredPropertyListing
  }
}

describe("ExtractorRegistry", () => {
  beforeEach(() => {
    // Access private registry to clear between tests
    const registry = (ExtractorRegistry as any).registry
    if (registry) registry.clear()
  })

  it("registers and retrieves an extractor", () => {
    const extractor = new MockExtractor("inmuebles")
    ExtractorRegistry.register(extractor)
    expect(ExtractorRegistry.get("inmuebles")).toBe(extractor)
  })

  it("returns undefined for unknown content type", () => {
    expect(ExtractorRegistry.get("nonexistent")).toBeUndefined()
  })

  it("lists all registered content types", () => {
    ExtractorRegistry.register(new MockExtractor("inmuebles"))
    ExtractorRegistry.register(new MockExtractor("vehiculos"))
    ExtractorRegistry.register(new MockExtractor("empleos"))

    const types = ExtractorRegistry.getAll()
    expect(types).toContain("inmuebles")
    expect(types).toContain("vehiculos")
    expect(types).toContain("empleos")
    expect(types.length).toBe(3)
  })

  it("overwrites existing registration for same contentType", () => {
    const first = new MockExtractor("inmuebles")
    const second = new MockExtractor("inmuebles")
    ExtractorRegistry.register(first)
    ExtractorRegistry.register(second)
    expect(ExtractorRegistry.get("inmuebles")).toBe(second)
  })
})
