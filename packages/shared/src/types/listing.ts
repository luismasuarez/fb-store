export interface Listing {
  id: string;
  fbPostId: string;
  title: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  description: string | null;
  contactPhone: string | null;
  contactName: string | null;
  location: string | null;
  images: string[];
  sourceGroup: string | null;
  sourceGroupId: string | null;
  sourceUrl: string | null;
  rawText: string | null;
  status: "active" | "sold" | "expired";
  aiConfidence: number | null;
  postedAt: string | null;
  scrapedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  aiRawData: unknown;
}

export interface RawPostDb {
  id: string;
  fbPostId: string;
  groupId: string | null;
  rawData: unknown;
  textContent: string | null;
  processed: boolean;
  listingId: string | null;
  aiProvider: string | null;
  scrapedAt: string;
}
