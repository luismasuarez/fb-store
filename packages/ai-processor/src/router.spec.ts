import { describe, it, expect } from "vitest"
import { routeClassification, classificationToStatus, type RoutingConfig, type RoutingDecision } from "./router"

describe("Status routing logic", () => {
  const defaultConfig: RoutingConfig = {
    rejectThreshold: 0.2,
    classifyThreshold: 0.5,
    groupPurpose: null,
  }

  it("returns rejected when confidence below rejectThreshold", () => {
    const result = routeClassification(
      { contentType: "inmuebles", confidence: 0.1, reasoning: "", detectedEntities: [] },
      defaultConfig,
    )
    expect(result).toBe("rejected")
  })

  it("returns review when confidence between thresholds", () => {
    const result = routeClassification(
      { contentType: "inmuebles", confidence: 0.35, reasoning: "", detectedEntities: [] },
      defaultConfig,
    )
    expect(result).toBe("review")
  })

  it("returns extract when confidence above classifyThreshold and contentType is inmuebles", () => {
    const result = routeClassification(
      { contentType: "inmuebles", confidence: 0.8, reasoning: "", detectedEntities: [] },
      defaultConfig,
    )
    expect(result).toBe("extract")
  })

  it("returns rejected when confidence above classifyThreshold but contentType is rejected", () => {
    const result = routeClassification(
      { contentType: "rejected", confidence: 0.8, reasoning: "", detectedEntities: [] },
      defaultConfig,
    )
    expect(result).toBe("rejected")
  })

  it("respects custom thresholds", () => {
    const customConfig: RoutingConfig = {
      rejectThreshold: 0.3,
      classifyThreshold: 0.7,
      groupPurpose: null,
    }

    const rejectedResult = routeClassification(
      { contentType: "inmuebles", confidence: 0.25, reasoning: "", detectedEntities: [] },
      customConfig,
    )
    expect(rejectedResult).toBe("rejected")

    const reviewResult = routeClassification(
      { contentType: "inmuebles", confidence: 0.5, reasoning: "", detectedEntities: [] },
      customConfig,
    )
    expect(reviewResult).toBe("review")

    const extractResult = routeClassification(
      { contentType: "inmuebles", confidence: 0.75, reasoning: "", detectedEntities: [] },
      customConfig,
    )
    expect(extractResult).toBe("extract")
  })

  it("handles boundary values correctly", () => {
    const resultAtRejectThreshold = routeClassification(
      { contentType: "inmuebles", confidence: 0.2, reasoning: "", detectedEntities: [] },
      defaultConfig,
    )
    expect(resultAtRejectThreshold).toBe("review")

    const resultAtClassifyThreshold = routeClassification(
      { contentType: "inmuebles", confidence: 0.5, reasoning: "", detectedEntities: [] },
      defaultConfig,
    )
    expect(resultAtClassifyThreshold).toBe("extract")
  })
})

describe("classificationToStatus", () => {
  it("maps decisions to correct status strings", () => {
    const cases: [RoutingDecision, string][] = [
      ["rejected", "rejected"],
      ["review", "review"],
      ["extract", "active"],
    ]

    for (const [decision, expectedStatus] of cases) {
      expect(classificationToStatus(decision)).toBe(expectedStatus)
    }
  })
})
