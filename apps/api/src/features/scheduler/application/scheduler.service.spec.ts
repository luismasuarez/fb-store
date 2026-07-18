import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { SchedulerService } from "./scheduler.service";

describe("SchedulerService", () => {
  let service: SchedulerService;
  let mockQueue: vi.Mocked<Partial<Queue>>;

  beforeEach(async () => {
    mockQueue = { upsertJobScheduler: vi.fn(), removeJobScheduler: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: getQueueToken("scrape"), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  describe("getSchedule", () => {
    it("returns default schedule config", () => {
      const schedule = service.getSchedule();
      expect(schedule).toEqual({
        intervalMinutes: 240,
        hourStart: 8,
        hourEnd: 22,
        enabled: true,
      });
    });
  });

  describe("updateSchedule", () => {
    it("updates intervalMinutes", async () => {
      const result = await service.updateSchedule({ intervalMinutes: 120 });
      expect(result.intervalMinutes).toBe(120);
    });

    it("validates intervalMinutes >= 30", async () => {
      await expect(service.updateSchedule({ intervalMinutes: 15 })).rejects.toThrow(
        "intervalMinutes must be >= 30",
      );
    });

    it("validates hourStart is 0-23", async () => {
      await expect(service.updateSchedule({ hourStart: 25 })).rejects.toThrow(
        "hourStart must be between 0 and 23",
      );
    });

    it("validates hourEnd is 1-24", async () => {
      await expect(service.updateSchedule({ hourEnd: 0 })).rejects.toThrow(
        "hourEnd must be between 1 and 24",
      );
    });

    it("validates hourEnd > hourStart", async () => {
      await expect(service.updateSchedule({ hourStart: 10, hourEnd: 8 })).rejects.toThrow(
        "hourEnd must be greater than hourStart",
      );
    });

    it("disables schedule when enabled=false", async () => {
      mockQueue.removeJobScheduler!.mockResolvedValue(undefined);

      const result = await service.updateSchedule({ enabled: false });

      expect(result.enabled).toBe(false);
      expect(mockQueue.removeJobScheduler).toHaveBeenCalledWith("auto-scrape");
    });

    it("registers schedule when enabled and interval changes", async () => {
      const result = await service.updateSchedule({ intervalMinutes: 60 });

      expect(result.intervalMinutes).toBe(60);
      expect(mockQueue.upsertJobScheduler).toHaveBeenCalled();
    });
  });
});
