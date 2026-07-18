import { Controller, Post, Body, HttpCode } from "@nestjs/common";
import { ScrapeService } from "../application/scrape.service";

interface ScrapeBody {
  groupId?: string;
  maxPosts?: number;
}

@Controller("api/scrape")
export class ScrapeController {
  constructor(private readonly scrapeService: ScrapeService) {}

  @Post()
  @HttpCode(202)
  async trigger(@Body() body: ScrapeBody) {
    return this.scrapeService.triggerScrape(body?.groupId, body?.maxPosts);
  }
}
