import { Injectable } from "@nestjs/common";
import { QueueService } from "../../../infrastructure/queue/queue.service";

@Injectable()
export class ScrapeService {
  constructor(private readonly queueService: QueueService) {}

  async triggerScrape(groupId?: string, maxPosts?: number) {
    const job = await this.queueService.addScrapeJob({ groupId, maxPosts });
    return { jobId: job.id };
  }

  async getJobStatus(jobId: string) {
    const job = await this.queueService.getJob("scrape", jobId);
    if (!job) {
      return null;
    }

    return {
      jobId: job.id,
      status: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp ? new Date(job.timestamp).toISOString() : null,
    };
  }
}
