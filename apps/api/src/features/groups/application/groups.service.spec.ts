import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { GroupsService } from "./groups.service";
import { GroupRepository } from "../infrastructure/group.repository";

const mockGroup = {
  id: "test-group",
  name: "Test Group",
  url: "https://facebook.com/groups/test",
  maxPosts: 30,
  lastScraped: null,
  lastError: null,
  isActive: true,
  createdAt: new Date(),
};

describe("GroupsService", () => {
  let service: GroupsService;
  let repo: { findAll: vi.Mock; findById: vi.Mock; findByUrl: vi.Mock; create: vi.Mock; update: vi.Mock; delete: vi.Mock };

  beforeEach(async () => {
    repo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByUrl: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: GroupRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  describe("findAll", () => {
    it("returns paginated groups", async () => {
      repo.findAll.mockResolvedValue({ data: [mockGroup], total: 1 });

      const result = await service.findAll(1, 20);

      expect(result).toEqual({
        data: [mockGroup],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      expect(repo.findAll).toHaveBeenCalledWith(1, 20);
    });

    it("calculates totalPages correctly", async () => {
      repo.findAll.mockResolvedValue({ data: [], total: 55 });

      const result = await service.findAll(1, 20);

      expect(result.pagination.totalPages).toBe(3);
    });

    it("uses default pagination values", async () => {
      repo.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.findAll();

      expect(repo.findAll).toHaveBeenCalledWith(1, 20);
    });
  });

  describe("findById", () => {
    it("returns a group when found", async () => {
      repo.findById.mockResolvedValue(mockGroup);

      const result = await service.findById("test-group");

      expect(result).toEqual({ data: mockGroup });
    });

    it("throws NotFoundException when group not found", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById("nonexistent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    const createDto = {
      id: "new-group",
      name: "New Group",
      url: "https://facebook.com/groups/new",
      maxPosts: 30,
      isActive: true,
    } as const;

    it("creates a group successfully", async () => {
      repo.findByUrl.mockResolvedValue(null);
      repo.create.mockResolvedValue({ ...mockGroup, id: "new-group", name: "New Group" });

      const result = await service.create(createDto);

      expect(result).toEqual({
        data: { ...mockGroup, id: "new-group", name: "New Group" },
      });
      expect(repo.create).toHaveBeenCalledWith(createDto);
    });

    it("rejects duplicate URL with 409 Conflict", async () => {
      repo.findByUrl.mockResolvedValue(mockGroup);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe("update", () => {
    const updateDto = { name: "Updated Group" };

    it("updates a group successfully", async () => {
      repo.findById.mockResolvedValue(mockGroup);
      repo.update.mockResolvedValue({ ...mockGroup, name: "Updated Group" });

      const result = await service.update("test-group", updateDto);

      expect(result).toEqual({
        data: { ...mockGroup, name: "Updated Group" },
      });
      expect(repo.update).toHaveBeenCalledWith("test-group", updateDto);
    });

    it("throws NotFoundException for non-existent group", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update("nonexistent", updateDto)).rejects.toThrow(NotFoundException);
    });

    it("rejects duplicate URL on change", async () => {
      const urlUpdateDto = { url: "https://facebook.com/groups/existing" };
      repo.findById.mockResolvedValue(mockGroup);
      repo.findByUrl.mockResolvedValue({
        ...mockGroup,
        id: "other-group",
        url: "https://facebook.com/groups/existing",
      });

      await expect(service.update("test-group", urlUpdateDto)).rejects.toThrow(ConflictException);
    });

    it("skips duplicate URL check when URL not changed", async () => {
      repo.findById.mockResolvedValue(mockGroup);
      repo.update.mockResolvedValue(mockGroup);

      const result = await service.update("test-group", { url: mockGroup.url });

      expect(result).toEqual({ data: mockGroup });
      expect(repo.findByUrl).not.toHaveBeenCalled();
    });

    it("skips duplicate URL check when url not provided", async () => {
      repo.findById.mockResolvedValue(mockGroup);
      repo.update.mockResolvedValue(mockGroup);

      const result = await service.update("test-group", { name: "Renamed" });

      expect(result).toEqual({ data: mockGroup });
      expect(repo.findByUrl).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes a group successfully", async () => {
      repo.findById.mockResolvedValue(mockGroup);
      repo.delete.mockResolvedValue(undefined);

      const result = await service.delete("test-group");

      expect(result).toEqual({ message: "Group deleted" });
    });

    it("throws NotFoundException for non-existent group", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.delete("nonexistent")).rejects.toThrow(NotFoundException);
    });
  });
});
