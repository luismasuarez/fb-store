import { Test, TestingModule } from "@nestjs/testing";
import { RawPostRepository } from "../infrastructure/raw-post.repository";
import { RawPostsService } from "./raw-posts.service";

describe("RawPostsService", () => {
  let service: RawPostsService;
  let repository: { findAll: vi.Mock; findById: vi.Mock };

  beforeEach(async () => {
    repository = { findAll: vi.fn(), findById: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RawPostsService,
        { provide: RawPostRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<RawPostsService>(RawPostsService);
  });

  describe("findAll", () => {
    it("returns wrapped paginated response", async () => {
      const posts = [{ id: "1", fbPostId: "fb1" }];
      repository.findAll.mockResolvedValue({ data: posts, total: 1 });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result).toEqual({
        data: posts,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it("passes filter params to repository", async () => {
      repository.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.findAll({
        page: 1,
        limit: 50,
        groupId: "group-1",
        status: "pending",
        scrapedAtGte: "2026-01-01T00:00:00Z",
        scrapedAtLte: "2026-06-30T23:59:59Z",
      });

      expect(repository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        groupId: "group-1",
        status: "pending",
        scrapedAtGte: "2026-01-01T00:00:00Z",
        scrapedAtLte: "2026-06-30T23:59:59Z",
      });
    });
  });

  describe("findOne", () => {
    it("returns wrapped raw post", async () => {
      const post = { id: "uuid-1", fbPostId: "fb1" };
      repository.findById.mockResolvedValue(post);

      const result = await service.findOne("uuid-1");

      expect(result).toEqual({ data: post });
    });

    it("throws NotFoundException when missing", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        "RawPost non-existent not found",
      );
    });
  });
});
