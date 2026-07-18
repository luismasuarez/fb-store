import { Test, TestingModule } from "@nestjs/testing";
import { QueueService } from "../../../infrastructure/queue/queue.service";
import { AiProcessorService } from "./ai-processor.service";

describe("AiProcessorService", () => {
  let service: AiProcessorService;
  let queueService: { addAiProcessJob: vi.Mock };

  beforeEach(async () => {
    queueService = { addAiProcessJob: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProcessorService,
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    service = module.get<AiProcessorService>(AiProcessorService);
  });

  describe("triggerProcessing", () => {
    it("enqueues job and returns jobId", async () => {
      queueService.addAiProcessJob.mockResolvedValue({ id: "job-789" });

      const result = await service.triggerProcessing(["post-1", "post-2"]);

      expect(queueService.addAiProcessJob).toHaveBeenCalledWith({
        rawPostIds: ["post-1", "post-2"],
      });
      expect(result).toEqual({ jobId: "job-789" });
    });

    it("works without rawPostIds", async () => {
      queueService.addAiProcessJob.mockResolvedValue({ id: "job-101" });

      const result = await service.triggerProcessing();

      expect(queueService.addAiProcessJob).toHaveBeenCalledWith({
        rawPostIds: undefined,
      });
      expect(result).toEqual({ jobId: "job-101" });
    });
  });
});
