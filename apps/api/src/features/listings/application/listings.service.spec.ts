import { Test, TestingModule } from "@nestjs/testing";
import { ListingRepository } from "../infrastructure/listing.repository";
import { ListingsService } from "./listings.service";

describe("ListingsService", () => {
  let service: ListingsService;
  let repository: { findAll: vi.Mock; findById: vi.Mock };

  beforeEach(async () => {
    repository = { findAll: vi.fn(), findById: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: ListingRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  describe("findAll", () => {
    it("returns wrapped paginated response", async () => {
      const listings = [{ id: "1", title: "Test" }];
      repository.findAll.mockResolvedValue({ data: listings, total: 1 });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result).toEqual({
        data: listings,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it("calculates totalPages correctly", async () => {
      repository.findAll.mockResolvedValue({ data: [], total: 55 });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it("passes query parameters to repository", async () => {
      repository.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.findAll({
        page: 2,
        limit: 10,
        listingType: "rent",
        propertyType: "apartment",
       listingType: "rent",
        province: "Madrid",
        sort: "price_asc",
      });

      expect(repository.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        listingType: "rent",
        propertyType: "apartment",
        province: "Madrid",
        sort: "price_asc",
      });
    });
  });

  describe("findOne", () => {
    it("returns wrapped listing", async () => {
      const listing = { id: "uuid-1", title: "Test" };
      repository.findById.mockResolvedValue(listing);

      const result = await service.findOne("uuid-1");

      expect(result).toEqual({ data: listing });
    });

    it("throws NotFoundException when missing", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        "Listing non-existent not found",
      );
    });
  });
});
