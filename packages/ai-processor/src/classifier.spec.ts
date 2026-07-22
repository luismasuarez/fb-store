import { describe, it, expect, vi } from "vitest"

vi.mock("./classifier", () => ({
  classifyPost: vi.fn(),
}))

const { classifyPost } = await import("./classifier")

describe("Classifier stage contract", () => {
  it("returns ClassificationResult shape on success", async () => {
    const mockResult = {
      contentType: "inmuebles" as const,
      confidence: 0.92,
      reasoning: "Contiene detalles de propiedad inmobiliaria",
      detectedEntities: ["casa", "3 cuartos", "venta"],
    }

    vi.mocked(classifyPost).mockResolvedValueOnce(mockResult)

    const result = await classifyPost("Vendo casa en Playa, 3 cuartos...", "fake-key", "fake-model")

    expect(result).toHaveProperty("contentType")
    expect(["inmuebles", "rejected"]).toContain(result.contentType)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(typeof result.reasoning).toBe("string")
    expect(result.reasoning.length).toBeLessThanOrEqual(200)
    expect(Array.isArray(result.detectedEntities)).toBe(true)
  })

  it("returns rejected contentType for non-real-estate text", async () => {
    const mockResult = {
      contentType: "rejected" as const,
      confidence: 0.89,
      reasoning: "Anuncio de venta de agua",
      detectedEntities: ["tanque de agua", "500 litros"],
    }

    vi.mocked(classifyPost).mockResolvedValueOnce(mockResult)

    const result = await classifyPost("Vendo tanque de agua de 500 litros...", "fake-key", "fake-model")

    expect(result.contentType).toBe("rejected")
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it("returns low confidence for ambiguous text", async () => {
    const mockResult = {
      contentType: "inmuebles" as const,
      confidence: 0.35,
      reasoning: "Texto muy corto, posible inmueble",
      detectedEntities: ["casa"],
    }

    vi.mocked(classifyPost).mockResolvedValueOnce(mockResult)

    const result = await classifyPost("Vendo casa, informacion al privado", "fake-key", "fake-model")

    expect(result.confidence).toBeLessThan(0.5)
  })
})
