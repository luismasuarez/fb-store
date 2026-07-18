import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../../infrastructure/database/prisma/prisma.service";
import { RawPostRepository } from "./raw-post.repository";

describe("RawPostRepository", () => {
  let repository: RawPostRepository;
  let prisma: {
    client: {
      rawPost: { findMany: vi.Mock; count: vi.Mock; findUnique: vi.Mock };
    };
  };

  beforeEach(async () => {
    prisma = {
      client: {
        rawPost: {
          findMany: vi.fn(),
          count: vi.fn(),
          findUnique: vi.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RawPostRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<RawPostRepository>(RawPostRepository);
  });

  describe("findAll", () => {
    const defaultQuery = { page: 1, limit: 20 };

    it("returns paginated results", async () => {
      const posts = [{ id: "1", fbPostId: "fb1", textContent: "post" }];
      prisma.client.rawPost.findMany.mockResolvedValue(posts);
      prisma.client.rawPost.count.mockResolvedValue(1);

      const result = await repository.findAll(defaultQuery);

      expect(result.data).toEqual(posts);
      expect(result.total).toBe(1);
    });

    it("filters by groupId", async () => {
      prisma.client.rawPost.findMany.mockResolvedValue([]);
      prisma.client.rawPost.count.mockResolvedValue(0);

      await repository.findAll({ ...defaultQuery, groupId: "group-1" });

      expect(prisma.client.rawPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ groupId: "group-1" }),
        }),
      );
    });

    it("filters by pending status", async () => {
      prisma.client.rawPost.findMany.mockResolvedValue([]);
      prisma.client.rawPost.count.mockResolvedValue(0);

      await repository.findAll({ ...defaultQuery, status: "pending" });

      expect(prisma.client.rawPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ processed: false }),
        }),
      );
    });

    it("filters by processed status", async () => {
      prisma.client.rawPost.findMany.mockResolvedValue([]);
      prisma.client.rawPost.count.mockResolvedValue(0);

      await repository.findAll({ ...defaultQuery, status: "processed" });

      expect(prisma.client.rawPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ processed: true }),
        }),
      );
    });

    it("filters by date range", async () => {
      prisma.client.rawPost.findMany.mockResolvedValue([]);
      prisma.client.rawPost.count.mockResolvedValue(0);

      await repository.findAll({
        ...defaultQuery,
        scrapedAtGte: "2026-01-01T00:00:00Z",
        scrapedAtLte: "2026-12-31T23:59:59Z",
      });

      expect(prisma.client.rawPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scrapedAt: {
              gte: new Date("2026-01-01T00:00:00Z"),
              lte: new Date("2026-12-31T23:59:59Z"),
            },
          }),
        }),
      );
    });

    it("selects only public fields", async () => {
      prisma.client.rawPost.findMany.mockResolvedValue([]);
      prisma.client.rawPost.count.mockResolvedValue(0);

      await repository.findAll(defaultQuery);

      expect(prisma.client.rawPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            fbPostId: true,
            groupId: true,
            textContent: true,
            processed: true,
            scrapedAt: true,
          },
        }),
      );
    });

    it("applies pagination offset", async () => {
      prisma.client.rawPost.findMany.mockResolvedValue([]);
      prisma.client.rawPost.count.mockResolvedValue(0);

      await repository.findAll({ page: 2, limit: 10 });

      expect(prisma.client.rawPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe("findById", () => {
    it("returns raw post when found", async () => {
      const post = { id: "uuid-1", fbPostId: "fb1" };
      prisma.client.rawPost.findUnique.mockResolvedValue(post);

      const result = await repository.findById("uuid-1");

      expect(result).toEqual(post);
      expect(prisma.client.rawPost.findUnique).toHaveBeenCalledWith({
        where: { id: "uuid-1" },
      });
    });

    it("returns null when not found", async () => {
      prisma.client.rawPost.findUnique.mockResolvedValue(null);

      const result = await repository.findById("non-existent");

      expect(result).toBeNull();
    });
  });
});
