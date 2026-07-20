import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Auth interceptor — attaches Bearer token from localStorage
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("fb-store-auth");
    if (raw) {
      const { accessToken } = JSON.parse(raw);
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
  } catch {
    // ignore parse errors
  }
  return config;
});

// Auth error interceptor — on 401, try to refresh once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status !== 401) return Promise.reject(error);
    if (error.config?._retryCount) return Promise.reject(error);

    error.config._retryCount = 1;

    try {
      const raw = localStorage.getItem("fb-store-auth");
      if (!raw) return Promise.reject(error);

      const parsed = JSON.parse(raw);
      if (!parsed.refreshToken) return Promise.reject(error);

      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: parsed.refreshToken }),
      });

      if (!res.ok) {
        localStorage.removeItem("fb-store-auth");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      const data = await res.json();
      localStorage.setItem("fb-store-auth", JSON.stringify(data));
      error.config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api.request(error.config);
    } catch {
      localStorage.removeItem("fb-store-auth");
      window.location.href = "/login";
      return Promise.reject(error);
    }
  },
);

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
  bedroomsMin?: number;
  bedroomsMax?: number;
  bathroomsMin?: number;
  bathroomsMax?: number;
  priceMin?: number;
  priceMax?: number;
  category?: string;
  status?: string;
  page?: number;
  limit?: number;
  query?: string;
}

export interface Group {
  id: string;
  name: string;
  url: string | null;
  maxPosts: number;
  isActive: boolean;
  lastScraped: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface CreateGroupInput {
  id: string;
  name: string;
  url: string;
  maxPosts?: number;
  isActive?: boolean;
}

export interface UpdateGroupInput {
  name?: string;
  url?: string;
  maxPosts?: number;
  isActive?: boolean;
}

export async function fetchListings(filters: ListingFilters = {}): Promise<PaginatedResponse<Listing>> {
  const params: Record<string, string> = {};
  if (filters.listingType) params.listingType = filters.listingType;
  if (filters.propertyType) params.propertyType = filters.propertyType;
  if (filters.province) params.province = filters.province;
  if (filters.municipality) params.municipality = filters.municipality;
  if (filters.neighborhood) params.neighborhood = filters.neighborhood;
  if (filters.bedroomsMin !== undefined) params.bedroomsMin = String(filters.bedroomsMin);
  if (filters.bedroomsMax !== undefined) params.bedroomsMax = String(filters.bedroomsMax);
  if (filters.bathroomsMin !== undefined) params.bathroomsMin = String(filters.bathroomsMin);
  if (filters.bathroomsMax !== undefined) params.bathroomsMax = String(filters.bathroomsMax);
  if (filters.priceMin !== undefined) params.priceMin = String(filters.priceMin);
  if (filters.priceMax !== undefined) params.priceMax = String(filters.priceMax);
  if (filters.category) params.category = filters.category;
  if (filters.status) params.status = filters.status;
  if (filters.page) params.page = String(filters.page);
  if (filters.limit) params.limit = String(filters.limit);
  if (filters.query) params.query = filters.query;
  const { data } = await api.get<PaginatedResponse<Listing>>("/listings", { params });
  return data;
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data } = await api.get<Listing | null>(`/listings/${id}`);
  return data;
}

export async function triggerScrape(groupId?: string, maxPosts?: number): Promise<{ jobId: string; alreadyRunning?: boolean; status?: string }> {
  const { data } = await api.post("/scrape", { groupId, maxPosts });
  return data;
}

export async function triggerScrapeAllGroups(): Promise<{ jobIds: string[] }> {
  const { data } = await api.post("/scrape/all");
  return data;
}

export async function getActiveScrapeJob(profile?: string): Promise<{ jobId: string; status: string; progress?: any; createdAt?: string } | null> {
  const { data } = await api.get("/scrape/active", { params: { profile } });
  return data.data;
}


export async function getJobStatus(jobId: string): Promise<{ jobId: string; status: string; progress?: any; result?: any; failedReason?: string }> {
  const { data } = await api.get(`/scrape/status/${jobId}`);
  return data.data ?? data;
}

export async function triggerAiProcess(rawPostIds?: string[]): Promise<{ jobId: string }> {
  const { data } = await api.post("/ai-process", { rawPostIds });
  return data;
}

export async function fetchGroups(page = 1, limit = 20): Promise<PaginatedResponse<Group>> {
  const { data } = await api.get<PaginatedResponse<Group>>("/groups", {
    params: { page, limit },
  });
  return data;
}

export async function createGroup(input: CreateGroupInput): Promise<Group> {
  const { data } = await api.post<{ data: Group }>("/groups", input);
  return data.data;
}

export async function updateGroup(id: string, input: UpdateGroupInput): Promise<Group> {
  const { data } = await api.put<{ data: Group }>(`/groups/${id}`, input);
  return data.data;
}

export async function deleteGroup(id: string): Promise<void> {
  await api.delete(`/groups/${id}`);
}

export function getImageUrl(image: ListingImage): string {
  if (image.data) return `data:${image.mime || "image/jpeg"};base64,${image.data}`;
  return image.url;
}
