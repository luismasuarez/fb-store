import { Controller, Post, Body, HttpCode, UseGuards } from "@nestjs/common";
import { ScrapeService } from "../application/scrape.service";
import { JwtAuthGuard } from "../../auth/api/jwt-auth.guard";
import { SkipAuth } from "../../../core/guards/api-key.guard";

interface ScrapeBody {
  groupId?: string;
  maxPosts?: number;
}

@SkipAuth()
@Controller("api/scrape")
export class ScrapeController {
  constructor(private readonly scrapeService: ScrapeService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(202)
  async trigger(@Body() body: ScrapeBody) {
    return this.scrapeService.triggerScrape(body?.groupId, body?.maxPosts);
  }
}
