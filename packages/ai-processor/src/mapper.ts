import type { StructuredPropertyListing } from "@fb-store/shared"
import type { ListingData } from "./db"

export function mapToListing(ai: StructuredPropertyListing, rawPost: any): ListingData {
  const price = parsePrice(ai.price)
  const confidence = ai.confidenceScore ?? 0

  return {
    fbPostId: rawPost.fbPostId,
    title: ai.title?.slice(0, 255),
    price: price ?? undefined,
    currency: detectCurrency(ai.price),
    description: ai.descriptionClean?.slice(0, 5000),
    category: ai.propertyType === "otro" ? "general" : "inmuebles",
    contactPhone: ai.contact?.phone?.slice(0, 50),
    contactName: ai.contact?.name?.slice(0, 100),
    location: [ai.location?.province, ai.location?.municipality, ai.location?.neighborhood]
      .filter(Boolean)
      .join(", "),
    images: [],
    sourceGroup: rawPost.groupId,
    sourceGroupId: rawPost.groupId,
    sourceUrl: rawPost.rawData?.postUrl,
    rawText: rawPost.textContent?.slice(0, 10000),
    status: confidence >= 0.3 ? "active" : "sold",
    aiConfidence: confidence,
    listingType: ai.listingType,
    propertyType: ai.propertyType,
    summaryShort: ai.summaryShort?.slice(0, 500),
    province: ai.location?.province,
    municipality: ai.location?.municipality,
    neighborhood: ai.location?.neighborhood,
    bedrooms: ai.propertyDetails?.bedrooms ?? undefined,
    bathrooms: ai.propertyDetails?.bathrooms ?? undefined,
    totalM2: parseArea(ai.propertyDetails?.totalArea),
    floors: ai.propertyDetails?.floors ?? undefined,
    parking: ai.features?.some((f) => /parqueo|garage|estacionamiento/i.test(f)) ?? false,
    furnished: ai.features?.some((f) => /amueblado|mueblado|equipado/i.test(f)) ?? false,
    aiRawData: ai,
  }
}

function parsePrice(price: string | undefined): number | null {
  if (!price) return null
  const cleaned = price.replace(/[^0-9.]/g, "")
  const num = Number.parseFloat(cleaned)
  return Number.isNaN(num) ? null : num
}

function detectCurrency(price: string | undefined): string {
  if (!price) return "CUP"
  const upper = price.toUpperCase()
  if (upper.includes("USD")) return "USD"
  if (upper.includes("MLC")) return "MLC"
  if (upper.includes("EUR")) return "EUR"
  return "CUP"
}

function parseArea(area: string | undefined): number | null {
  if (!area) return null
  const cleaned = area.replace(/[^0-9.]/g, "")
  const num = Number.parseFloat(cleaned)
  return Number.isNaN(num) ? null : Math.round(num)
}
