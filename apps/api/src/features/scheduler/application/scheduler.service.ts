import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

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

  constructor(
    @InjectQueue("scrape") private scrapeQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.registerSchedule();
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

    await this.registerSchedule();
    return this.getSchedule();
  }

  private async registerSchedule() {
    if (!this.config.enabled) {
      try {
        await this.scrapeQueue.removeJobScheduler("auto-scrape");
      } catch {
        // not registered yet
      }
      this.logger.log("Scheduler disabled");
      return;
    }

    const cron = this.buildCron(
      this.config.intervalMinutes,
      this.config.hourStart,
      this.config.hourEnd,
    );

    await this.scrapeQueue.upsertJobScheduler(
      "auto-scrape",
      { pattern: cron },
      { name: "scrape-all", data: {} },
    );

    this.logger.log(`Scheduler registered: every ${this.config.intervalMinutes}min, ${this.config.hourStart}:00-${this.config.hourEnd}:00`);
  }

  private buildCron(intervalMinutes: number, hourStart: number, hourEnd: number): string {
    const hourSpan = hourEnd - hourStart;
    const intervalHours = Math.max(1, Math.floor(intervalMinutes / 60));
    const step = Math.max(1, Math.floor(hourSpan / intervalHours));

    return `0 ${hourStart}-${hourEnd - 1}/${step} * * *`;
  }
}
