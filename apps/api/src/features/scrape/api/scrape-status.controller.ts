import { Controller, Get, Param, NotFoundException } from "@nestjs/common";
import { ScrapeService } from "../application/scrape.service";

@Controller("api/scrape/status")
export class ScrapeStatusController {
  constructor(private readonly scrapeService: ScrapeService) {}

  @Get(":jobId")
  async getStatus(@Param("jobId") jobId: string) {
    const status = await this.scrapeService.getJobStatus(jobId);
    if (!status) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return { data: status };
  }
}
