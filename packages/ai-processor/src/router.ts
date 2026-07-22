import type { ClassificationResult } from "@fb-store/shared"

export interface RoutingConfig {
  rejectThreshold: number
  classifyThreshold: number
  groupPurpose: string | null
}

export type RoutingDecision = "rejected" | "review" | "extract"

export function routeClassification(
  result: ClassificationResult,
  config: RoutingConfig,
): RoutingDecision {
  const rejectThreshold = config.rejectThreshold ?? 0.2
  const classifyThreshold = config.classifyThreshold ?? 0.5

  if (result.confidence < rejectThreshold) {
    return "rejected"
  }

  if (result.confidence < classifyThreshold) {
    return "review"
  }

  if (result.contentType === "inmuebles") {
    return "extract"
  }

  return "rejected"
}

export function classificationToStatus(decision: RoutingDecision): string {
  switch (decision) {
    case "rejected":
      return "rejected"
    case "review":
      return "review"
    case "extract":
      return "active"
  }
}
