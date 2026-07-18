import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../../infrastructure/database/prisma/prisma.service";
import { ListingRepository } from "./listing.repository";

describe("ListingRepository", () => {
  let repository: ListingRepository;
  let prisma: {
    client: {
      listing: { findMany: vi.Mock; count: vi.Mock; findUnique: vi.Mock };
    };
  };

  beforeEach(async () => {
    prisma = {
      client: {
        listing: {
          findMany: vi.fn(),
          count: vi.fn(),
          findUnique: vi.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<ListingRepository>(ListingRepository);
  });

  describe("findAll", () => {
    const defaultQuery = { page: 1, limit: 20 };

    it("returns paginated results", async () => {
      const listings = [{ id: "1", title: "Test" }];
      prisma.client.listing.findMany.mockResolvedValue(listings);
      prisma.client.listing.count.mockResolvedValue(1);

      const result = await repository.findAll(defaultQuery);

      expect(result.data).toEqual(listings);
      expect(result.total).toBe(1);
      expect(prisma.client.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it("applies pagination offset correctly", async () => {
      prisma.client.listing.findMany.mockResolvedValue([]);
      prisma.client.listing.count.mockResolvedValue(0);

      await repository.findAll({ page: 3, limit: 10 });

      expect(prisma.client.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("filters by listing_type", async () => {
      prisma.client.listing.findMany.mockResolvedValue([]);
      prisma.client.listing.count.mockResolvedValue(0);

      await repository.findAll({ ...defaultQuery, listingType: "sale" });

      expect(prisma.client.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ listingType: "sale" }),
        }),
      );
    });

    it("filters by property_type", async () => {
      prisma.client.listing.findMany.mockResolvedValue([]);
      prisma.client.listing.count.mockResolvedValue(0);

      await repository.findAll({ ...defaultQuery, propertyType: "apartment" });

      expect(prisma.client.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ propertyType: "apartment" }),
        }),
      );
    });

    it("filters by province and municipality", async () => {
      prisma.client.listing.findMany.mockResolvedValue([]);
      prisma.client.listing.count.mockResolvedValue(0);

      await repository.findAll({
        ...defaultQuery,
        province: "Barcelona",
        municipality: "Barcelona",
      });

      expect(prisma.client.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            province: "Barcelona",
            municipality: "Barcelona",
          }),
        }),
      );
    });

    it("filters by price range", async () => {
      prisma.client.listing.findMany.mockResolvedValue([]);
      prisma.client.listing.count.mockResolvedValue(0);

      await repository.findAll({ ...defaultQuery, minPrice: 500, maxPrice: 1500 });

      expect(prisma.client.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: { gte: 500, lte: 1500 },
          }),
        }),
      );
    });

    it("sorts by newest by default", async () => {
      prisma.client.listing.findMany.mockResolvedValue([]);
      prisma.client.listing.count.mockResolvedValue(0);

      await repository.findAll(defaultQuery);

      expect(prisma.client.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { scrapedAt: "desc" } }),
      );
    });

    it("sorts ascending when sort=oldest", async () => {
      prisma.client.listing.findMany.mockResolvedValue([]);
      prisma.client.listing.count.mockResolvedValue(0);

      await repository.findAll({ ...defaultQuery, sort: "oldest" });

      expect(prisma.client.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { scrapedAt: "asc" } }),
      );
    });

    it("orders by price ascending", async () => {
      prisma.client.listing.findMany.mockResolvedValue([]);
      prisma.client.listing.count.mockResolvedValue(0);

      await repository.findAll({ ...defaultQuery, sort: "price_asc" });

      expect(prisma.client.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { price: "asc" } }),
      );
    });
  });

  describe("findById", () => {
    it("returns listing when found", async () => {
      const listing = { id: "uuid-1", title: "Test" };
      prisma.client.listing.findUnique.mockResolvedValue(listing);

      const result = await repository.findById("uuid-1");

      expect(result).toEqual(listing);
      expect(prisma.client.listing.findUnique).toHaveBeenCalledWith({
        where: { id: "uuid-1" },
      });
    });

    it("returns null when not found", async () => {
      prisma.client.listing.findUnique.mockResolvedValue(null);

      const result = await repository.findById("non-existent");

      expect(result).toBeNull();
    });
  });
});
