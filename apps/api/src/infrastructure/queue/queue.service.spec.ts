import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { QueueService } from "./queue.service";

describe("QueueService", () => {
  let service: QueueService;
  let mockAiQueue: vi.Mocked<Partial<Queue>>;

  beforeEach(async () => {
    mockAiQueue = { add: vi.fn(), getJob: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: getQueueToken("ai-process"), useValue: mockAiQueue },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
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
    it("gets job from ai-process queue", async () => {
      mockAiQueue.getJob!.mockResolvedValue({ id: "job-2" } as Job);

      const result = await service.getJob("ai-process", "job-2");

      expect(mockAiQueue.getJob).toHaveBeenCalledWith("job-2");
      expect(result).toEqual({ id: "job-2" });
    });

    it("returns undefined when job not found", async () => {
      mockAiQueue.getJob!.mockResolvedValue(undefined);

      const result = await service.getJob("ai-process", "non-existent");

      expect(result).toBeUndefined();
    });
  });
});
