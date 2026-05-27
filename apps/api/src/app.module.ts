import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { RawPostsModule } from "./raw-posts/raw-posts.module";
import { ListingsModule } from "./listings/listings.module";
import { ScraperModule } from "./scraper/scraper.module";
import { AiProcessorModule } from "./ai-processor/ai-processor.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, "../../.env"), ".env"],
    }),
    PrismaModule,
    RawPostsModule,
    ListingsModule,
    ScraperModule,
    AiProcessorModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
