import { Module } from "@nestjs/common";
import { AiProcessorModule } from "../ai-processor/ai-processor.module";
import { GroupsModule } from "../groups/groups.module";
import { ScrapeController } from "./api/scrape.controller";
import { ScrapeStatusController } from "./api/scrape-status.controller";
import { ScrapeService } from "./application/scrape.service";

@Module({
  imports: [AiProcessorModule, GroupsModule],
  controllers: [ScrapeController, ScrapeStatusController],
  providers: [ScrapeService],
})
export class ScrapeModule {}
