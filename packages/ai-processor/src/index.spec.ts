import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetPendingPosts = vi.fn();
const mockMarkSkipped = vi.fn();
const mockMarkProcessed = vi.fn();
const mockMarkDuplicate = vi.fn();
const mockCreateListing = vi.fn();
const mockUpdateListingImages = vi.fn();
const mockMapToListing = vi.fn();
const mockDownloadImages = vi.fn().mockResolvedValue([]);
const mockExtract = vi.fn();

vi.mock("./db", () => ({
  getPendingPosts: (...args: any[]) => mockGetPendingPosts(...args),
  markSkipped: (...args: any[]) => mockMarkSkipped(...args),
  markProcessed: (...args: any[]) => mockMarkProcessed(...args),
  markDuplicate: (...args: any[]) => mockMarkDuplicate(...args),
  createListing: (...args: any[]) => mockCreateListing(...args),
  updateListingImages: (...args: any[]) => mockUpdateListingImages(...args),
}));

vi.mock("./mapper", () => ({
  mapToListing: (...args: any[]) => mockMapToListing(...args),
}));

vi.mock("./image-downloader", () => ({
  downloadImagesAsBase64: (...args: any[]) => mockDownloadImages(...args),
}));

vi.mock("./extractor", () => ({
  createExtractor: () => ({ extract: mockExtract }),
}));

vi.mock("@fb-store/shared", () => ({
  getPrismaClient: () => ({ $connect: vi.fn() }),
}));

vi.mock("./config", () => ({
  loadConfig: () => ({
    providerName: "openrouter",
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    batchSize: 10,
  }),
}));

import { processPost, processBatch, getPendingPosts } from "./index";

describe("ai-processor exports", () => {
  const mockPost = {
    id: "post-1",
    fbPostId: "fb-123",
    textContent: "Vendo piso en Barcelona, 3 habitaciones, 80m2, 150000€",
    groupId: "group-1",
    rawData: { images: [] },
    scrapedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPendingPosts", () => {
    it("delegates to db.getPendingPosts", async () => {
      mockGetPendingPosts.mockResolvedValue([mockPost]);

      const result = await getPendingPosts(10);

      expect(mockGetPendingPosts).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockPost]);
    });
  });

  describe("processPost", () => {
    it("skips posts shorter than 20 chars", async () => {
      mockMarkSkipped.mockResolvedValue(undefined);

      const result = await processPost(
        { ...mockPost, textContent: "short" },
        { extract: mockExtract },
      );

      expect(result).toBeNull();
      expect(mockMarkSkipped).toHaveBeenCalledWith("post-1");
      expect(mockExtract).not.toHaveBeenCalled();
    });

    it("processes valid post and returns fbPostId", async () => {
      mockExtract.mockResolvedValue({
        title: "Piso en Barcelona",
        price: { amount: 150000, currency: "EUR" },
        descriptionClean: "Piso en buen estado",
        confidenceScore: 0.95,
        contact: { phones: ["+34 600 000 000"], facebookName: "Juan" },
        location: { province: "Barcelona", municipality: "Barcelona", neighborhood: "Eixample", address: "Carrer Test 123" },
        listingType: "sale",
        propertyType: "apartment",
        summaryShort: "Piso en Eixample",
        propertyDetails: { bedrooms: 3, bathrooms: 1, totalM2: 80, floors: 4, parking: false, furnished: true },
      });
      mockMapToListing.mockReturnValue({
        fbPostId: "fb-123",
        title: "Piso en Barcelona",
        rawPosts: { connect: { id: "post-1" } },
      });
      mockCreateListing.mockResolvedValue("listing-uuid");
      mockMarkProcessed.mockResolvedValue(undefined);

      const result = await processPost(mockPost, { extract: mockExtract });

      expect(result).toBe("fb-123");
      expect(mockExtract).toHaveBeenCalledWith(mockPost.textContent);
      expect(mockCreateListing).toHaveBeenCalled();
      expect(mockMarkProcessed).toHaveBeenCalledWith("post-1");
    });

    it("handles duplicate listings (P2002)", async () => {
      mockExtract.mockResolvedValue({
        title: "Piso en Barcelona",
        price: { amount: 150000, currency: "EUR" },
        descriptionClean: "Piso en buen estado",
        confidenceScore: 0.95,
        contact: { phones: [], facebookName: null },
        location: { province: "Barcelona", municipality: "Barcelona", neighborhood: null, address: null },
        listingType: "sale",
        propertyType: "apartment",
        summaryShort: null,
        propertyDetails: { bedrooms: null, bathrooms: null, totalM2: null, floors: null, parking: null, furnished: null },
      });
      mockMapToListing.mockReturnValue({
        fbPostId: "fb-123",
        title: "Piso en Barcelona",
        rawPosts: { connect: { id: "post-1" } },
      });
      mockCreateListing.mockRejectedValue({ code: "P2002" });
      mockMarkDuplicate.mockResolvedValue(undefined);

      const result = await processPost(mockPost, { extract: mockExtract });

      expect(result).toBeNull();
      expect(mockMarkDuplicate).toHaveBeenCalledWith("post-1");
    });

    it("rethrows non-duplicate errors", async () => {
      mockExtract.mockResolvedValue({
        title: "Piso en Barcelona",
        price: { amount: 150000, currency: "EUR" },
        descriptionClean: null,
        confidenceScore: 0.8,
        contact: { phones: [], facebookName: null },
        location: { province: "Barcelona", municipality: null, neighborhood: null, address: null },
        listingType: "sale",
        propertyType: "apartment",
        summaryShort: null,
        propertyDetails: { bedrooms: null, bathrooms: null, totalM2: null, floors: null, parking: null, furnished: null },
      });
      mockMapToListing.mockReturnValue({
        fbPostId: "fb-123",
        title: "Piso en Barcelona",
        rawPosts: { connect: { id: "post-1" } },
      });
      mockCreateListing.mockRejectedValue(new Error("DB connection failed"));

      await expect(processPost(mockPost, { extract: mockExtract })).rejects.toThrow(
        "DB connection failed",
      );
    });
  });

  describe("processBatch", () => {
    it("processes all pending posts", async () => {
      mockGetPendingPosts
        .mockResolvedValueOnce([mockPost])
        .mockResolvedValueOnce([]);
      mockExtract.mockResolvedValue({
        title: "Test Property",
        price: { amount: 100000, currency: "USD" },
        descriptionClean: "Nice place",
        confidenceScore: 0.9,
        contact: { phones: [], facebookName: null },
        location: { province: "Madrid", municipality: "Madrid", neighborhood: null, address: null },
        listingType: "sale",
        propertyType: "apartment",
        summaryShort: null,
        propertyDetails: { bedrooms: null, bathrooms: null, totalM2: null, floors: null, parking: null, furnished: null },
      });
      mockMapToListing.mockReturnValue({
        fbPostId: "fb-123",
        title: "Test Property",
        rawPosts: { connect: { id: "post-1" } },
      });
      mockCreateListing.mockResolvedValue("listing-uuid");
      mockMarkProcessed.mockResolvedValue(undefined);

      const result = await processBatch();

      expect(result.processed).toBe(1);
      expect(result.created).toBe(1);
      expect(result.errors).toBe(0);
    });

    it("handles errors gracefully in batch", async () => {
      mockGetPendingPosts
        .mockResolvedValueOnce([mockPost])
        .mockResolvedValueOnce([]);
      mockExtract.mockRejectedValue(new Error("API error"));

      const result = await processBatch();

      expect(result.processed).toBe(0);
      expect(result.created).toBe(0);
      expect(result.errors).toBe(1);
    });

    it("processes specific post IDs when provided", async () => {
      mockGetPendingPosts.mockResolvedValue([mockPost]);
      mockExtract.mockResolvedValue({
        title: "Test Property",
        price: { amount: 100000, currency: "USD" },
        descriptionClean: "Nice place",
        confidenceScore: 0.9,
        contact: { phones: [], facebookName: null },
        location: { province: "Madrid", municipality: "Madrid", neighborhood: null, address: null },
        listingType: "sale",
        propertyType: "apartment",
        summaryShort: null,
        propertyDetails: { bedrooms: null, bathrooms: null, totalM2: null, floors: null, parking: null, furnished: null },
      });
      mockMapToListing.mockReturnValue({
        fbPostId: "fb-123",
        title: "Test Property",
        rawPosts: { connect: { id: "post-1" } },
      });
      mockCreateListing.mockResolvedValue("listing-uuid");
      mockMarkProcessed.mockResolvedValue(undefined);

      const result = await processBatch(["post-1"]);

      expect(result.processed).toBe(1);
      expect(result.created).toBe(1);
    });
  });
});
