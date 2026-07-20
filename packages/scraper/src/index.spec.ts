import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("./db", () => ({
  getPrismaClient: () => ({
    rawPost: { create: mockCreate },
    scrapeLog: { create: mockFindUnique },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  }),
  sanitizeFacebookText: (text: string) => text,
}));

const { savePosts, saveScrapeLog } = await import("./index");

describe("scraper exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("savePosts", () => {
    const posts = [
      {
        fbPostId: "post-1",
        text: "This is a test post with enough text to pass the 20 char filter",
        images: [],
      },
      {
        fbPostId: "post-2",
        text: "Another test post for verification purposes here",
        images: ["http://example.com/img.jpg"],
      },
    ];

    it("saves each post to the database", async () => {
      mockCreate.mockResolvedValue({ id: "uuid-1" });

      const saved = await savePosts(posts, "group-1");

      expect(saved).toBe(2);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("skips duplicates (P2002)", async () => {
      mockCreate
        .mockRejectedValueOnce({ code: "P2002" })
        .mockResolvedValueOnce({ id: "uuid-2" });

      const saved = await savePosts(posts, "group-1");

      expect(saved).toBe(1);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("sanitizes text content and limits to 10000 chars", async () => {
      mockCreate.mockResolvedValue({ id: "uuid-1" });

      await savePosts(
        [
          {
            fbPostId: "post-3",
            text: "A".repeat(15000),
            images: [],
          },
        ],
        "group-1",
      );

      const data = mockCreate.mock.calls[0][0].data;
      expect(data.textContent.length).toBe(10000);
    });

    it("returns 0 for empty posts array", async () => {
      const saved = await savePosts([], "group-1");
      expect(saved).toBe(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("saveScrapeLog", () => {
    it("saves scrape log entry", async () => {
      mockFindUnique.mockResolvedValue({ id: "log-uuid" });

      await saveScrapeLog({
        groupId: "group-1",
        postsFound: 10,
        postsNew: 5,
        durationMs: 3000,
      });

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
      const data = mockFindUnique.mock.calls[0][0].data;
      expect(data.groupId).toBe("group-1");
      expect(data.postsFound).toBe(10);
      expect(data.postsNew).toBe(5);
      expect(data.durationMs).toBe(3000);
      expect(data.accountIndex).toBe(0);
      expect(data.postsErrors).toBe(0);
      expect(data.finishedAt).toBeInstanceOf(Date);
    });
  });
});
