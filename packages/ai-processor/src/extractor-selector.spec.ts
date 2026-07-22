import { describe, it, expect, vi } from "vitest"

vi.mock("./classifier", () => ({
  classifyPost: vi.fn(),
}))

function MockExtractor() {
  return {
    extract: vi.fn().mockResolvedValue({
      listingType: "venta",
      propertyType: "casa",
      title: "Test house listing",
      descriptionClean: "Vendo casa en Playa, 3 cuartos, 2 banos",
      summaryShort: "Casa en venta en Playa",
      price: "25000 USD",
      location: { province: "La Habana", municipality: "Playa", neighborhood: null },
      propertyDetails: { bedrooms: 3, bathrooms: 2, totalArea: "100 m2", floors: 1 },
      features: ["parqueo", "cocina"],
      includedItems: [],
      services: [],
      securityFeatures: [],
      contact: { name: "Juan", phone: "5555-1234" },
      media: { images: [] },
      sellerNotes: "",
      missingInformation: [],
      confidenceScore: 0.9,
      rawEntitiesDetected: ["casa", "venta"],
    }),
  }
}

vi.mock("@fb-store/shared", () => ({
  Extractor: vi.fn(MockExtractor),
  ExtractorRegistry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn() },
  extractWithOpenRouter: vi.fn(),
}))

vi.mock("./db", () => ({
  getPendingPosts: vi.fn(),
  markProcessed: vi.fn(),
  markDuplicate: vi.fn(),
  createListing: vi.fn().mockResolvedValue({ id: "listing-1" }),
  updateListingImages: vi.fn(),
  getGroupConfig: vi.fn().mockResolvedValue({
    purpose: "inmuebles",
    rejectThreshold: 0.2,
    classifyThreshold: 0.5,
  }),
}))

vi.mock("./cleaner", () => ({
  cleanPostText: (text: string) => text,
}))

vi.mock("./image-downloader", () => ({
  downloadImagesAsBase64: vi.fn().mockResolvedValue([]),
}))

vi.mock("./config", () => ({
  getAiConfig: vi.fn().mockReturnValue({
    provider: "openrouter",
    apiKey: "fake-key",
    model: "fake-model",
    classifierModel: "fake-classifier-model",
    batchSize: 10,
  }),
  reloadAiConfig: vi.fn(),
}))

const { processPost } = await import("./index")

describe("Extractor selection based on classification", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("skips extraction and stores as rejected when classified as rejected", async () => {
    const { classifyPost } = await import("./classifier")
    const { createListing } = await import("./db")

    vi.mocked(classifyPost).mockResolvedValueOnce({
      contentType: "rejected",
      confidence: 0.89,
      reasoning: "No es inmobiliario",
      detectedEntities: ["tanque de agua"],
    })

    const result = await processPost({
      id: "post-1",
      fbPostId: "fb-1",
      groupId: "group-1",
      textContent: "Vendo tanque de agua",
      rawData: {},
    })

    expect(result.ok).toBe(true)

    const listingData = vi.mocked(createListing).mock.calls[0][0]
    expect(listingData.status).toBe("rejected")
    expect(listingData.aiConfidence).toBe(0.89)
  })

  it("runs extraction when classified as inmuebles with high confidence", async () => {
    const { classifyPost } = await import("./classifier")
    const { createListing } = await import("./db")

    vi.mocked(classifyPost).mockResolvedValueOnce({
      contentType: "inmuebles",
      confidence: 0.92,
      reasoning: "Contiene detalles de propiedad",
      detectedEntities: ["casa", "3 cuartos"],
    })

    const result = await processPost({
      id: "post-2",
      fbPostId: "fb-2",
      groupId: "group-1",
      textContent: "Vendo casa en Playa, 3 cuartos, 2 banos",
      rawData: {},
    })

    expect(result.ok).toBe(true)

    const listingData = vi.mocked(createListing).mock.calls[0][0]
    expect(listingData.status).toBe("active")
  })

  it("stores image-only posts as review instead of discarding", async () => {
    const { createListing } = await import("./db")

    const result = await processPost({
      id: "post-3",
      fbPostId: "fb-3",
      groupId: "group-1",
      textContent: "",
      rawData: { images: [{ url: "http://example.com/img.jpg" }] },
    })

    expect(result.ok).toBe(true)

    const listingData = vi.mocked(createListing).mock.calls[0][0]
    expect(listingData.status).toBe("review")
  })

  it("stores short text without images as duplicate", async () => {
    const { markDuplicate } = await import("./db")

    const result = await processPost({
      id: "post-4",
      fbPostId: "fb-4",
      groupId: "group-1",
      textContent: "solo",
      rawData: {},
    })

    expect(result.ok).toBe(true)
    expect(markDuplicate).toHaveBeenCalledWith("post-4")
  })
})
