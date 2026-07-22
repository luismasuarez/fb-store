import { describe, it, expect, vi, beforeEach } from "vitest"
import { routeClassification, type RoutingConfig } from "./router"

describe("Purpose-based routing", () => {
  const defaultConfig: RoutingConfig = {
    rejectThreshold: 0.2,
    classifyThreshold: 0.5,
    groupPurpose: null,
  }

  it("routes with purpose=inmuebles and high confidence to extract", () => {
    const config: RoutingConfig = { ...defaultConfig, groupPurpose: "inmuebles" }
    const result = routeClassification(
      { contentType: "inmuebles", confidence: 0.9, reasoning: "", detectedEntities: [] },
      config,
    )
    expect(result).toBe("extract")
  })

  it("routes inmuebles content with low confidence to review regardless of purpose", () => {
    const config: RoutingConfig = { ...defaultConfig, groupPurpose: "inmuebles" }
    const result = routeClassification(
      { contentType: "inmuebles", confidence: 0.35, reasoning: "", detectedEntities: [] },
      config,
    )
    expect(result).toBe("review")
  })
})
