import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";

export interface AiProcessJobData {
  rawPostIds?: string[];
}

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue("ai-process") private aiQueue: Queue,
  ) {}

  async addAiProcessJob(data: AiProcessJobData): Promise<Job> {
    return this.aiQueue.add("process-pending", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 60000 },
      timeout: 120000,
      removeOnFail: false,
    });
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    return this.aiQueue.getJob(jobId);
  }
}
