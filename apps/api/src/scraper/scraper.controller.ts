import { Controller, Post } from "@nestjs/common";
import { ScraperService } from "./scraper.service";

@Controller("api/scrape")
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post()
  async run() {
    return this.scraperService.run();
  }
}
