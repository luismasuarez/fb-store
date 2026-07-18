import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AppConfigService } from "../config/app-config.service";
import { QueueService } from "./queue.service";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: AppConfigService) => ({
        connection: {
          host: config.getString("REDIS_HOST", "localhost"),
          port: config.getNumber("REDIS_PORT", 6379),
        },
        prefix: config.getString("BULL_PREFIX", "{fb-store}"),
      }),
      inject: [AppConfigService],
    }),
    BullModule.registerQueue(
      { name: "scrape" },
      { name: "ai-process" },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
