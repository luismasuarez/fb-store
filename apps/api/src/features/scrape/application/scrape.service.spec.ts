import { Test, TestingModule } from "@nestjs/testing";
import { QueueService } from "../../../infrastructure/queue/queue.service";
import { ScrapeService } from "./scrape.service";

describe("ScrapeService", () => {
  let service: ScrapeService;
  let queueService: { addScrapeJob: vi.Mock; getJob: vi.Mock };

  beforeEach(async () => {
    queueService = { addScrapeJob: vi.fn(), getJob: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapeService,
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    service = module.get<ScrapeService>(ScrapeService);
  });

  describe("triggerScrape", () => {
    it("enqueues job and returns jobId", async () => {
      queueService.addScrapeJob.mockResolvedValue({ id: "job-123" });

      const result = await service.triggerScrape("group-1", 10);

      expect(queueService.addScrapeJob).toHaveBeenCalledWith({
        groupId: "group-1",
        maxPosts: 10,
      });
      expect(result).toEqual({ jobId: "job-123" });
    });

    it("works without optional params", async () => {
      queueService.addScrapeJob.mockResolvedValue({ id: "job-456" });

      const result = await service.triggerScrape();

      expect(queueService.addScrapeJob).toHaveBeenCalledWith({
        groupId: undefined,
        maxPosts: undefined,
      });
      expect(result).toEqual({ jobId: "job-456" });
    });
  });

  describe("getJobStatus", () => {
    it("returns formatted job status", async () => {
      const job = {
        id: "job-123",
        getState: vi.fn().mockResolvedValue("completed"),
        progress: 100,
        returnvalue: { postsFound: 15 },
        failedReason: null,
        timestamp: 1700000000000,
      };
      queueService.getJob.mockResolvedValue(job);

      const result = await service.getJobStatus("job-123");

      expect(result).toEqual({
        jobId: "job-123",
        status: "completed",
        progress: 100,
        result: { postsFound: 15 },
        failedReason: null,
        timestamp: "2023-11-14T22:13:20.000Z",
      });
    });

    it("returns null when job not found", async () => {
      queueService.getJob.mockResolvedValue(null);

      const result = await service.getJobStatus("non-existent");

      expect(result).toBeNull();
    });

    it("handles waiting jobs", async () => {
      const job = {
        id: "job-456",
        getState: vi.fn().mockResolvedValue("waiting"),
        progress: 0,
        returnvalue: null,
        failedReason: null,
        timestamp: null,
      };
      queueService.getJob.mockResolvedValue(job);

      const result = await service.getJobStatus("job-456");

      expect(result.status).toBe("waiting");
      expect(result.timestamp).toBeNull();
    });
  });
});
