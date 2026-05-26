import type { StructuredPropertyListing } from "@fb-store/shared";

function toBoolean(val: unknown): boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val;
  if (val === 1 || val === "1" || val === "true") return true;
  if (val === 0 || val === "0" || val === "false") return false;
  return null;
}

export interface ListingData {
  fbPostId: string;
  title: string | null;
  price: number | null;
  currency: string;
  description: string | null;
  rawText: string;
  images: any[];
  sourceGroupId: string | null;
  status: string;
  aiConfidence: number;
  contactPhone: string | null;
  contactName: string | null;
  location: string | null;
  listingType: string | null;
  propertyType: string | null;
  summaryShort: string | null;
  province: string | null;
  municipality: string | null;
  neighborhood: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  totalM2: number | null;
  floors: number | null;
  parking: boolean | null;
  furnished: boolean | null;
  aiRawData: any;
  rawPosts: { connect: { id: string } };
}

export function mapToListing(
  r: StructuredPropertyListing,
  rawPost: { id: string; fbPostId: string; textContent: string | null; rawData: any },
): ListingData {
  const text = rawPost.textContent || "";
  return {
    fbPostId: rawPost.fbPostId,
    title: r.title,
    price: r.price.amount,
    currency: r.price.currency || "Bs",
    description: r.descriptionClean,
    rawText: text.substring(0, 10000),
    images: rawPost.rawData?.images || [],
    sourceGroupId: rawPost.rawData?.groupId || null,
    status: r.confidenceScore >= 0.3 ? "active" : "sold",
    aiConfidence: r.confidenceScore,
    contactPhone: r.contact.phones?.[0] || null,
    contactName: r.contact.facebookName || null,
    location: r.location.address || r.location.municipality || r.location.province || null,
    listingType: r.listingType,
    propertyType: r.propertyType,
    summaryShort: r.summaryShort,
    province: r.location.province,
    municipality: r.location.municipality,
    neighborhood: r.location.neighborhood,
    bedrooms: r.propertyDetails.bedrooms,
    bathrooms: r.propertyDetails.bathrooms,
    totalM2: r.propertyDetails.totalM2,
    floors: r.propertyDetails.floors,
    parking: toBoolean(r.propertyDetails.parking),
    furnished: toBoolean(r.propertyDetails.furnished),
    aiRawData: r,
    rawPosts: { connect: { id: rawPost.id } },
  };
}
