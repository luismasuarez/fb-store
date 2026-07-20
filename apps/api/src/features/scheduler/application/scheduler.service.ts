import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { AppConfigService } from "../../../infrastructure/config/app-config.service";
import { GroupsService } from "../../groups/application/groups.service";
import { AiProcessorService } from "../../ai-processor/application/ai-processor.service";

interface ScheduleConfig {
  intervalMinutes: number;
  hourStart: number;
  hourEnd: number;
  enabled: boolean;
}

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private config: ScheduleConfig = {
    intervalMinutes: 240,
    hourStart: 8,
    hourEnd: 22,
    enabled: true,
  };
  private isRunning = false;
  private readonly scraperUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: AppConfigService,
    private readonly groupsService: GroupsService,
    private readonly aiProcessorService: AiProcessorService,
  ) {
    this.scraperUrl = configService.getRequiredString("SCRAPER_URL");
    this.apiKey = configService.getRequiredString("SCRAPER_API_KEY");
  }

  onModuleInit() {
    this.registerSchedule();
  }

  getSchedule(): ScheduleConfig {
    return { ...this.config };
  }

  async updateSchedule(update: Partial<ScheduleConfig>): Promise<ScheduleConfig> {
    if (update.intervalMinutes !== undefined) {
      if (update.intervalMinutes < 30) {
        throw new Error("intervalMinutes must be >= 30");
      }
      this.config.intervalMinutes = update.intervalMinutes;
    }
    if (update.hourStart !== undefined) {
      if (update.hourStart < 0 || update.hourStart > 23) {
        throw new Error("hourStart must be between 0 and 23");
      }
      this.config.hourStart = update.hourStart;
    }
    if (update.hourEnd !== undefined) {
      if (update.hourEnd < 1 || update.hourEnd > 24) {
        throw new Error("hourEnd must be between 1 and 24");
      }
      if (update.hourEnd <= this.config.hourStart) {
        throw new Error("hourEnd must be greater than hourStart");
      }
      this.config.hourEnd = update.hourEnd;
    }
    if (update.enabled !== undefined) {
      this.config.enabled = update.enabled;
    }

    this.registerSchedule();
    return this.getSchedule();
  }

  async executeScrapeCycle(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Previous cycle still running, skipping");
      return;
    }

    if (!this.config.enabled) return;

    this.isRunning = true;
    this.logger.log("Scrape cycle started");

    try {
      const { data: groups } = await this.groupsService.findActive();

      for (const group of groups) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 300_000);

          const res = await fetch(`${this.scraperUrl}/api/v1/scrape`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.apiKey,
            },
            body: JSON.stringify({ groupId: group.id, maxPosts: group.maxPosts, wait: true }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (res.ok) {
            await this.aiProcessorService.triggerProcessing();
          }
        } catch (err) {
          this.logger.error(`Error scraping group ${group.id}: ${(err as Error).message}`);
        }
      }
    } finally {
      this.isRunning = false;
      this.logger.log("Scrape cycle completed");
    }
  }

  private registerSchedule(): void {
    try {
      this.schedulerRegistry.deleteCronJob("auto-scrape");
    } catch {
      // not registered yet
    }

    if (!this.config.enabled) {
      this.logger.log("Scheduler disabled");
      return;
    }

    const cron = this.buildCron(
      this.config.intervalMinutes,
      this.config.hourStart,
      this.config.hourEnd,
    );

    const job = new CronJob(cron, () => this.executeScrapeCycle());
    this.schedulerRegistry.addCronJob("auto-scrape", job);
    job.start();

    this.logger.log(`Scheduler registered: every ${this.config.intervalMinutes}min, ${this.config.hourStart}:00-${this.config.hourEnd}:00`);
  }

  private buildCron(intervalMinutes: number, hourStart: number, hourEnd: number): string {
    const hourSpan = hourEnd - hourStart;
    const intervalHours = Math.max(1, Math.floor(intervalMinutes / 60));
    const step = Math.max(1, Math.floor(hourSpan / intervalHours));

    return `0 ${hourStart}-${hourEnd - 1}/${step} * * *`;
  }
}
