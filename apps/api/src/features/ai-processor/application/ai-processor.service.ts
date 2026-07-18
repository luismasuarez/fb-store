import { Injectable } from "@nestjs/common";
import { QueueService } from "../../../infrastructure/queue/queue.service";

@Injectable()
export class AiProcessorService {
  constructor(private readonly queueService: QueueService) {}

  async triggerProcessing(rawPostIds?: string[]) {
    const job = await this.queueService.addAiProcessJob({ rawPostIds });
    return { jobId: job.id };
  }
}
