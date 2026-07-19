import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../../../infrastructure/config/app-config.service";

@Injectable()
export class ScrapeService {
  private readonly scraperUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config: AppConfigService) {
    this.scraperUrl = config.getRequiredString("SCRAPER_URL");
    this.apiKey = config.getRequiredString("SCRAPER_API_KEY");
  }

  async triggerScrape(groupId?: string, maxPosts?: number) {
    const res = await fetch(`${this.scraperUrl}/api/v1/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({ groupId, maxPosts }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message ?? `Scraper responded with ${res.status}`,
      );
    }

    const body = await res.json();
    return { jobId: body.jobId };
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

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message ?? `Scraper responded with ${res.status}`,
      );
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
}
