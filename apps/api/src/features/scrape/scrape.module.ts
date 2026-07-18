import { Module } from "@nestjs/common";
import { ScrapeController } from "./api/scrape.controller";
import { ScrapeStatusController } from "./api/scrape-status.controller";
import { ScrapeService } from "./application/scrape.service";

@Module({
  controllers: [ScrapeController, ScrapeStatusController],
  providers: [ScrapeService],
})
export class ScrapeModule {}
