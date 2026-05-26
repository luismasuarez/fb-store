import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListingImage {
  url: string;
  mime: string;
  data: string;
}

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
  images: ListingImage[];
  sourceGroup: string | null;
  sourceGroupId: string | null;
  sourceUrl: string | null;
  rawText: string | null;
  status: string;
  aiConfidence: number | null;
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
  postedAt: string | null;
  scrapedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingFilters {
  listingType?: string;
  propertyType?: string;
  province?: string;
  municipality?: string;
  neighborhood?: string;
  bedrooms?: number;
  bathrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  status?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export async function fetchListings(
  filters: ListingFilters
): Promise<PaginatedResponse<Listing>> {
  const params: Record<string, string> = {};
  if (filters.listingType) params.listing_type = filters.listingType;
  if (filters.propertyType) params.property_type = filters.propertyType;
  if (filters.province) params.province = filters.province;
  if (filters.municipality) params.municipality = filters.municipality;
  if (filters.neighborhood) params.neighborhood = filters.neighborhood;
  if (filters.bedrooms !== undefined) params.bedrooms = String(filters.bedrooms);
  if (filters.bathrooms !== undefined) params.bathrooms = String(filters.bathrooms);
  if (filters.minPrice !== undefined) params.min_price = String(filters.minPrice);
  if (filters.maxPrice !== undefined) params.max_price = String(filters.maxPrice);
  if (filters.currency) params.currency = filters.currency;
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;
  if (filters.sort) params.sort = filters.sort;
  if (filters.page) params.page = String(filters.page);
  if (filters.limit) params.limit = String(filters.limit);

  const { data } = await api.get<PaginatedResponse<Listing>>("/listings", { params });
  return data;
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data } = await api.get<Listing | null>(`/listings/${id}`);
  return data;
}

export function getImageUrl(image: ListingImage): string {
  if (image.data) return `data:${image.mime || "image/jpeg"};base64,${image.data}`;
  return image.url;
}
