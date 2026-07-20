import { Test, TestingModule } from "@nestjs/testing";
import { AppConfigService } from "../../../infrastructure/config/app-config.service";
import { GroupsService } from "../../groups/application/groups.service";
import { AiProcessorService } from "../../ai-processor/application/ai-processor.service";
import { ScrapeService } from "./scrape.service";

function mockFetch(
  status: number,
  body: unknown,
): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

describe("ScrapeService", () => {
  let service: ScrapeService;
  let config: { getRequiredString: ReturnType<typeof vi.fn> };
  let fetchSpy: ReturnType<typeof vi.fn>;
  let aiProcessorService: { triggerProcessing: ReturnType<typeof vi.fn> };
  let groupsService: { findActive: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    config = {
      getRequiredString: vi.fn((key: string) => {
        if (key === "SCRAPER_URL") return "http://scraper:3001";
        if (key === "SCRAPER_API_KEY") return "test-api-key";
        throw new Error(`Unexpected key: ${key}`);
      }),
    };

    aiProcessorService = { triggerProcessing: vi.fn() };
    groupsService = { findActive: vi.fn() };
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapeService,
        { provide: AppConfigService, useValue: config },
        { provide: GroupsService, useValue: groupsService },
        { provide: AiProcessorService, useValue: aiProcessorService },
      ],
    }).compile();

    service = module.get<ScrapeService>(ScrapeService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("triggerScrape", () => {
    it("calls scraper and returns jobId", async () => {
      fetchSpy.mockImplementation(
        mockFetch(202, { jobId: "job-123" }),
      );

      const result = await service.triggerScrape("group-1", 10);

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://scraper:3001/api/v1/scrape",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "test-api-key",
          },
          body: JSON.stringify({ groupId: "group-1", maxPosts: 10 }),
        },
      );
      expect(result).toEqual({ jobId: "job-123" });
    });

    it("works without optional params", async () => {
      fetchSpy.mockImplementation(
        mockFetch(202, { jobId: "job-456" }),
      );

      const result = await service.triggerScrape();

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://scraper:3001/api/v1/scrape",
        expect.objectContaining({
          body: JSON.stringify({ groupId: undefined, maxPosts: undefined }),
        }),
      );
      expect(result).toEqual({ jobId: "job-456" });
    });

    it("throws on scraper error", async () => {
      fetchSpy.mockImplementation(
        mockFetch(500, {
          error: { message: "Internal error" },
        }),
      );

      await expect(service.triggerScrape()).rejects.toThrow(
        "Internal error",
      );
    });
  });

  describe("getJobStatus", () => {
    it("returns formatted job status", async () => {
      fetchSpy.mockImplementation(
        mockFetch(200, {
          id: "job-123",
          status: "completed",
          progress: { phase: "saving", current: 15, total: 15 },
          result: { posts: [], metrics: { postsFound: 15, postsNew: 15, durationMs: 5000 } },
          failedReason: undefined,
          createdAt: "2023-11-14T22:13:20.000Z",
        }),
      );

      const result = await service.getJobStatus("job-123");

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://scraper:3001/api/v1/scrape/job-123",
        { headers: { "x-api-key": "test-api-key" } },
      );
      expect(result).toEqual({
        jobId: "job-123",
        status: "completed",
        progress: { phase: "saving", current: 15, total: 15 },
        result: { posts: [], metrics: { postsFound: 15, postsNew: 15, durationMs: 5000 } },
        failedReason: undefined,
        timestamp: "2023-11-14T22:13:20.000Z",
      });
    });

    it("returns null when job not found", async () => {
      fetchSpy.mockImplementation(mockFetch(404, {}));

      const result = await service.getJobStatus("non-existent");

      expect(result).toBeNull();
    });

    it("handles null createdAt", async () => {
      fetchSpy.mockImplementation(
        mockFetch(200, {
          id: "job-456",
          status: "waiting",
          progress: { phase: "queued", current: 0, total: 0 },
          result: null,
          failedReason: undefined,
          createdAt: null,
        }),
      );

      const result = await service.getJobStatus("job-456");

      expect(result.status).toBe("waiting");
      expect(result.timestamp).toBeNull();
    });
  });

  describe("waitForJob", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("T009: polls every 5s until completed", async () => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });

      const jobStatusSpy = vi.spyOn(service as any, "getJobStatus");
      jobStatusSpy
        .mockResolvedValueOnce({ status: "pending" })
        .mockResolvedValueOnce({ status: "running" })
        .mockResolvedValueOnce({ status: "completed", result: { metrics: { postsNew: 5 } } });

      const waitPromise = (service as any).waitForJob("job-123", 30000);

      await vi.advanceTimersByTimeAsync(10000);

      const result = await waitPromise;

      expect(result.status).toBe("completed");
      expect(jobStatusSpy).toHaveBeenCalledTimes(3);
    });

    it("T010: times out after configured timeout", async () => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });

      const jobStatusSpy = vi.spyOn(service as any, "getJobStatus");
      jobStatusSpy.mockResolvedValue({ status: "pending" });

      const waitPromise = (service as any).waitForJob("job-123", 10000);
      waitPromise.catch(() => {}); // Suppress unhandled rejection during fake timer advance

      await vi.advanceTimersByTimeAsync(10000);

      await expect(waitPromise).rejects.toThrow("timed out after 10000ms");
    });
  });

  describe("chainAfterScrape", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("T011: calls triggerProcessing when postsNew > 0", async () => {
      vi.spyOn(service as any, "getJobStatus").mockResolvedValue({
        status: "completed",
        result: { metrics: { postsNew: 5 } },
      });

      await (service as any).chainAfterScrape("job-123");

      expect(aiProcessorService.triggerProcessing).toHaveBeenCalled();
    });

    it("T012: skips AI when postsNew === 0", async () => {
      vi.spyOn(service as any, "getJobStatus").mockResolvedValue({
        status: "completed",
        result: { metrics: { postsNew: 0 } },
      });

      await (service as any).chainAfterScrape("job-123");

      expect(aiProcessorService.triggerProcessing).not.toHaveBeenCalled();
    });
  });
});
