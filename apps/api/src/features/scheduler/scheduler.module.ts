import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { SchedulerController } from "./api/scheduler.controller";
import { SchedulerService } from "./application/scheduler.service";

@Module({
  imports: [
    BullModule.registerQueue({ name: "scrape" }),
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
