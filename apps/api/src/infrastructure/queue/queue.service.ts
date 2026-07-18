import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";

export interface ScrapeJobData {
  groupId?: string;
  maxPosts?: number;
}

export interface AiProcessJobData {
  rawPostIds?: string[];
}

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue("scrape") private scrapeQueue: Queue,
    @InjectQueue("ai-process") private aiQueue: Queue,
  ) {}

  async addScrapeJob(data: ScrapeJobData): Promise<Job> {
    return this.scrapeQueue.add("scrape-group", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  async addAiProcessJob(data: AiProcessJobData): Promise<Job> {
    return this.aiQueue.add("process-pending", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 60000 },
      timeout: 120000,
      removeOnFail: false,
    });
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = queueName === "scrape" ? this.scrapeQueue : this.aiQueue;
    return queue.getJob(jobId);
  }
}
