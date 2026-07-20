import { Injectable, Logger, ConflictException, BadRequestException, NotFoundException, ServiceUnavailableException, BadGatewayException, UnauthorizedException, InternalServerErrorException } from "@nestjs/common";
import { AppConfigService } from "../../../infrastructure/config/app-config.service";
import { GroupsService } from "../../groups/application/groups.service";
import { AiProcessorService } from "../../ai-processor/application/ai-processor.service";

function classifyScraperError(code: string | undefined, status: number, message: string): never {
  if (status === 409) throw new ConflictException(message);
  if (status === 404) throw new NotFoundException(message);
  switch (code) {
    case "business":
      throw new ConflictException(message);
    case "invalid_url":
    case "validation":
      throw new BadRequestException(message);
    case "session_expired":
      throw new UnauthorizedException(message);
    case "db_error":
      throw new ServiceUnavailableException(message);
    case "network_error":
      throw new BadGatewayException(message);
    default:
      throw new InternalServerErrorException(message);
  }
}

@Injectable()
export class ScrapeService {
  private readonly scraperUrl: string;
  private readonly apiKey: string;
  private readonly logger = new Logger(ScrapeService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly groupsService: GroupsService,
    private readonly aiProcessorService: AiProcessorService,
  ) {
    this.scraperUrl = config.getRequiredString("SCRAPER_URL");
    this.apiKey = config.getRequiredString("SCRAPER_API_KEY");
  }

  async triggerScrape(groupId?: string, maxPosts?: number) {
    const result = await this.triggerScrapeInternal(groupId, maxPosts);
    this.chainAfterScrape(result.jobId).catch((err) => {
      this.logger.error(`Background chainAfterScrape failed: ${(err as Error).message}`);
    });
    return result;
  }

  private async triggerScrapeInternal(groupId?: string, maxPosts?: number) {
    const res = await fetch(`${this.scraperUrl}/api/v1/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({ groupId, maxPosts }),
    });

    const body = await res.json().catch(() => ({}));

    if (body.alreadyRunning) {
      this.logger.log(`Reusing active job ${body.jobId} for group ${groupId}`);
      return { jobId: body.jobId, alreadyRunning: true as const, status: body.status };
    }

    if (!res.ok) {
      classifyScraperError(body?.error?.code, res.status, body?.error?.message ?? `Scraper responded with ${res.status}`);
    }

    const result = { jobId: body.jobId };
    this.chainAfterScrape(body.jobId).catch((err) => {
      this.logger.error(`Background chainAfterScrape failed: ${(err as Error).message}`);
    });

    return result;
  }

  async triggerScrapeForAllGroups(): Promise<{ jobIds: string[] }> {
    const groupsResponse = await this.groupsService.findActive();
    const groups = groupsResponse.data;
    const jobIds: string[] = [];

    for (const group of groups) {
      const result = await this.triggerScrape(group.id, group.maxPosts);
      jobIds.push(result.jobId);
    }

    return { jobIds };
  }

  async getActiveScrapeJob(profile = "cuenta-1") {
    const res = await fetch(`${this.scraperUrl}/api/v1/scrape/active/${profile}`, {
      headers: { "x-api-key": this.apiKey },
    });

    if (!res.ok) return null;

    const body = await res.json();
    if (!body.active) return null;

    return {
      jobId: body.jobId,
      status: body.status,
      progress: body.progress,
      createdAt: body.createdAt,
    };
  }

  async fetchJobEventsStream(jobId: string): Promise<Response | null> {
    const res = await fetch(`${this.scraperUrl}/api/v1/scrape/${jobId}/events`, {
      headers: { "x-api-key": this.apiKey },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res;
  }

  async getJobStatus(jobId: string) {
    const res = await fetch(
      `${this.scraperUrl}/api/v1/scrape/${jobId}`,
      {
        headers: { "x-api-key": this.apiKey },
      },
    );

    if (res.status === 404) return null;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      classifyScraperError(err?.error?.code, res.status, err?.error?.message ?? `Scraper responded with ${res.status}`);
    }

    const job = await res.json();

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      failedReason: job.failedReason,
      timestamp: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    };
  }

  private async waitForJob(jobId: string, timeoutMs = 120_000): Promise<any> {
    const pollIntervalMs = 5_000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const job = await this.getJobStatus(jobId);
      if (job?.status === "completed" || job?.status === "failed") {
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
  }

  private async chainAfterScrape(jobId: string): Promise<void> {
    try {
      const job = await this.waitForJob(jobId);

      if (job?.status === "failed") {
        this.logger.warn(`Job ${jobId} completed with failed status, skipping AI chain`);
        return;
      }

      if (job?.status !== "completed") return;

      const postsNew = job?.result?.metrics?.postsNew ?? 0;
      if (postsNew > 0) {
        await this.aiProcessorService.triggerProcessing();
      } else {
        this.logger.log(`Job ${jobId} completed with 0 new posts, skipping AI chain`);
      }
    } catch (err) {
      this.logger.error(`chainAfterScrape failed for job ${jobId}: ${(err as Error).message}`);
    }
  }
}
