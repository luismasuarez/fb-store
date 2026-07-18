import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { QueueService } from "./queue.service";

describe("QueueService", () => {
  let service: QueueService;
  let mockScrapeQueue: vi.Mocked<Partial<Queue>>;
  let mockAiQueue: vi.Mocked<Partial<Queue>>;

  beforeEach(async () => {
    mockScrapeQueue = { add: vi.fn(), getJob: vi.fn() };
    mockAiQueue = { add: vi.fn(), getJob: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: getQueueToken("scrape"), useValue: mockScrapeQueue },
        { provide: getQueueToken("ai-process"), useValue: mockAiQueue },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe("addScrapeJob", () => {
    it("adds job to scrape queue with retry options", async () => {
      const data = { groupId: "group-1", maxPosts: 10 };
      mockScrapeQueue.add!.mockResolvedValue({ id: "job-1" } as Job);

      const result = await service.addScrapeJob(data);

      expect(mockScrapeQueue.add).toHaveBeenCalledWith("scrape-group", data, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
      expect(result).toEqual({ id: "job-1" });
    });
  });

  describe("addAiProcessJob", () => {
    it("adds job to ai-process queue with timeout options", async () => {
      const data = { rawPostIds: ["post-1"] };
      mockAiQueue.add!.mockResolvedValue({ id: "job-2" } as Job);

      const result = await service.addAiProcessJob(data);

      expect(mockAiQueue.add).toHaveBeenCalledWith("process-pending", data, {
        attempts: 3,
        backoff: { type: "exponential", delay: 60000 },
        timeout: 120000,
        removeOnFail: false,
      });
      expect(result).toEqual({ id: "job-2" });
    });
  });

  describe("getJob", () => {
    it("gets job from scrape queue when queueName is scrape", async () => {
      mockScrapeQueue.getJob!.mockResolvedValue({ id: "job-1" } as Job);

      const result = await service.getJob("scrape", "job-1");

      expect(mockScrapeQueue.getJob).toHaveBeenCalledWith("job-1");
      expect(result).toEqual({ id: "job-1" });
    });

    it("gets job from ai-process queue when queueName is ai-process", async () => {
      mockAiQueue.getJob!.mockResolvedValue({ id: "job-2" } as Job);

      const result = await service.getJob("ai-process", "job-2");

      expect(mockAiQueue.getJob).toHaveBeenCalledWith("job-2");
      expect(result).toEqual({ id: "job-2" });
    });

    it("returns undefined when job not found", async () => {
      mockScrapeQueue.getJob!.mockResolvedValue(undefined);

      const result = await service.getJob("scrape", "non-existent");

      expect(result).toBeUndefined();
    });
  });
});
