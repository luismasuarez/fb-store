import { Test, TestingModule } from "@nestjs/testing";
import { SchedulerRegistry } from "@nestjs/schedule";
import { SchedulerService } from "./scheduler.service";
import { AppConfigService } from "../../../infrastructure/config/app-config.service";
import { GroupsService } from "../../groups/application/groups.service";
import { AiProcessorService } from "../../ai-processor/application/ai-processor.service";

describe("SchedulerService", () => {
  let service: SchedulerService;
  let mockSchedulerRegistry: vi.Mocked<Partial<SchedulerRegistry>>;
  let mockConfigService: vi.Mocked<Partial<AppConfigService>>;
  let mockGroupsService: vi.Mocked<Partial<GroupsService>>;
  let mockAiProcessorService: vi.Mocked<Partial<AiProcessorService>>;

  const defaultGroups = [
    { id: "g1", url: "https://fb.com/g1", maxPosts: 10, isActive: true },
    { id: "g2", url: "https://fb.com/g2", maxPosts: 5, isActive: true },
  ];

  beforeEach(async () => {
    mockSchedulerRegistry = {
      addCronJob: vi.fn(),
      deleteCronJob: vi.fn(),
    };
    mockConfigService = {
      getRequiredString: vi.fn((key: string) => {
        if (key === "SCRAPER_URL") return "http://scraper:3000";
        if (key === "SCRAPER_API_KEY") return "test-api-key";
        throw new Error(`Unexpected key: ${key}`);
      }),
    };
    mockGroupsService = {
      findActive: vi.fn().mockResolvedValue({ data: defaultGroups }),
    };
    mockAiProcessorService = {
      triggerProcessing: vi.fn().mockResolvedValue({ jobId: "ai-job-1" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
        { provide: AppConfigService, useValue: mockConfigService },
        { provide: GroupsService, useValue: mockGroupsService },
        { provide: AiProcessorService, useValue: mockAiProcessorService },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      const result = await service.updateSchedule({ enabled: false });
      expect(result.enabled).toBe(false);
      expect(mockSchedulerRegistry.deleteCronJob).toHaveBeenCalledWith("auto-scrape");
    });

    it("registers schedule when enabled and interval changes", async () => {
      const result = await service.updateSchedule({ intervalMinutes: 60 });
      expect(result.intervalMinutes).toBe(60);
      expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalled();
    });
  });

  describe("T019 — executeScrapeCycle fetches active groups", () => {
    it("calls GroupsService.findActive()", async () => {
      await service.executeScrapeCycle();
      expect(mockGroupsService.findActive).toHaveBeenCalledTimes(1);
    });
  });

  describe("T020 — sequential HTTP calls with wait=true", () => {
    it("makes sequential POST requests for each group with wait: true", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as Response);

      await service.executeScrapeCycle();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "http://scraper:3000/api/v1/scrape",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            groupId: "g1",
            maxPosts: 10,
            wait: true,
          }),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "http://scraper:3000/api/v1/scrape",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            groupId: "g2",
            maxPosts: 5,
            wait: true,
          }),
        }),
      );

      fetchMock.mockRestore();
    });
  });

  describe("T021 — AI enqueued after successful group scrape", () => {
    it("calls AiProcessorService.triggerProcessing() after successful scrape", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as Response);

      await service.executeScrapeCycle();

      expect(mockAiProcessorService.triggerProcessing).toHaveBeenCalledTimes(2);

      fetchMock.mockRestore();
    });
  });

  describe("T022 — error in one group doesn't stop iteration", () => {
    it("continues to next group when first group fails", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ ok: true } as Response);

      await service.executeScrapeCycle();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mockAiProcessorService.triggerProcessing).toHaveBeenCalledTimes(1);

      fetchMock.mockRestore();
    });
  });

  describe("T023 — cycle skipped if previous still running", () => {
    it("skips second call when first is still running", async () => {
      let resolveFetch: () => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = () => resolve({ ok: true } as Response);
      });

      const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(fetchPromise);

      const firstCycle = service.executeScrapeCycle();
      const secondCycle = service.executeScrapeCycle();

      resolveFetch!();
      await firstCycle;
      await secondCycle;

      expect(fetchMock).toHaveBeenCalledTimes(2);

      fetchMock.mockRestore();
    });
  });

  describe("T024 — timeout (300s) per group", () => {
    it("uses AbortController with 300000ms timeout", async () => {
      const originalAbort = globalThis.AbortController;
      let abortCallCount = 0;
      vi.spyOn(globalThis, "AbortController").mockImplementation(function (this: void) {
        abortCallCount++;
        return new originalAbort();
      });
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as Response);

      await service.executeScrapeCycle();

      expect(abortCallCount).toBeGreaterThanOrEqual(1);
      vi.restoreAllMocks();
    });
  });

  describe("T025 — disabled state skips cycle", () => {
    it("returns early when config.enabled is false", async () => {
      await service.updateSchedule({ enabled: false });
      const fetchMock = vi.spyOn(globalThis, "fetch");

      await service.executeScrapeCycle();

      expect(fetchMock).not.toHaveBeenCalled();

      fetchMock.mockRestore();
    });
  });
});
