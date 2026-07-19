import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fb-store/shared", () => ({
  getPrismaClient: vi.fn(),
}));

vi.mock("../index", () => ({
  scrapeGroup: vi.fn(),
}));

vi.mock("./job-tracker", () => ({
  updateJob: vi.fn(),
  notifyClients: vi.fn(),
}));

import { getPrismaClient } from "@fb-store/shared";
import { scrapeGroup } from "../index";
import { updateJob, notifyClients } from "./job-tracker";
import { runScrape } from "./scrape-runner";

const mockPost = {
  fbPostId: "fb-123",
  text: "Test post with enough text to pass validation filters",
  images: [],
  author: "Test User",
  authorUrl: "/user/test",
  timestamp: "2024-01-01T00:00:00Z",
  postUrl: "/groups/123/posts/456",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runScrape", () => {
  it("T017: calls scrapeGroup with correct params and onProgress", async () => {
    vi.mocked(scrapeGroup).mockImplementation(async (_profileDir, _group, _maxScrolls, _scrollDelayMs, onProgress) => {
      if (onProgress) {
        onProgress("navigating", 1, 1);
        onProgress("scrolling", 1, 4);
        onProgress("scrolling", 2, 4);
        onProgress("extracting", 1, 1);
        onProgress("downloading", 1, 1);
        onProgress("saving", 1, 1);
      }
      return [mockPost];
    });

    const result = await runScrape("job-1", {
      url: "https://facebook.com/groups/123",
      maxPosts: 20,
      profile: "cuenta-1",
    });

    expect(scrapeGroup).toHaveBeenCalledTimes(1);
    expect(scrapeGroup).toHaveBeenCalledWith(
      expect.stringContaining("cuenta-1"),
      { id: "123", name: "123", maxPosts: 20 },
      4,
      4000,
      expect.any(Function),
    );

    expect(updateJob).toHaveBeenCalledWith("job-1", {
      progress: { phase: "navigating", current: 1, total: 1 },
    });
    expect(updateJob).toHaveBeenCalledWith("job-1", {
      progress: { phase: "scrolling", current: 1, total: 4 },
    });
    expect(updateJob).toHaveBeenCalledWith("job-1", {
      progress: { phase: "scrolling", current: 2, total: 4 },
    });
    expect(updateJob).toHaveBeenCalledWith("job-1", {
      progress: { phase: "extracting", current: 1, total: 1 },
    });
    expect(updateJob).toHaveBeenCalledWith("job-1", {
      progress: { phase: "downloading", current: 1, total: 1 },
    });
    expect(updateJob).toHaveBeenCalledWith("job-1", {
      progress: { phase: "saving", current: 1, total: 1 },
    });

    expect(notifyClients).toHaveBeenCalledWith("job-1", {
      type: "progress",
      data: { phase: "navigating", current: 1, total: 1 },
    });
    expect(notifyClients).toHaveBeenCalledWith("job-1", {
      type: "complete",
      data: expect.objectContaining({ posts: [mockPost] }),
    });

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].fbPostId).toBe("fb-123");
    expect(result.metrics.groupId).toBe("123");
    expect(result.metrics.postsFound).toBe(1);
    expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("extracts groupId from URL when url is provided", async () => {
    vi.mocked(scrapeGroup).mockResolvedValue([mockPost]);

    await runScrape("job-2", {
      url: "https://www.facebook.com/groups/my-group-name/",
      maxPosts: 10,
      profile: "test-profile",
    });

    expect(scrapeGroup).toHaveBeenCalledWith(
      expect.stringContaining("test-profile"),
      { id: "my-group-name", name: "my-group-name", maxPosts: 10 },
      expect.any(Number),
      expect.any(Number),
      expect.any(Function),
    );
  });

  it("uses groupId directly when provided, loading config from DB", async () => {
    vi.mocked(scrapeGroup).mockResolvedValue([mockPost]);

    const mockGroup = { id: "group-789", name: "DB Group Name", maxPosts: 50 };
    const mockPrisma = {
      group: { findUnique: vi.fn().mockResolvedValue(mockGroup) },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma as any);

    await runScrape("job-3", {
      groupId: "group-789",
      maxPosts: 30,
      profile: "cuenta-1",
    });

    expect(mockPrisma.group.findUnique).toHaveBeenCalledWith({ where: { id: "group-789" } });
    expect(scrapeGroup).toHaveBeenCalledWith(
      expect.any(String),
      { id: "group-789", name: "DB Group Name", maxPosts: 50 },
      expect.any(Number),
      expect.any(Number),
      expect.any(Function),
    );
  });

  it("throws BUSINESS:Group not found when groupId is unknown", async () => {
    const mockPrisma = {
      group: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma as any);

    await expect(runScrape("job-4", {
      groupId: "unknown-group",
      maxPosts: 20,
      profile: "cuenta-1",
    })).rejects.toThrow("BUSINESS:Group not found");
  });
});
