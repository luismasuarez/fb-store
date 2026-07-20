import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AiProcessorModule } from "../ai-processor/ai-processor.module";
import { GroupsModule } from "../groups/groups.module";
import { SchedulerController } from "./api/scheduler.controller";
import { SchedulerService } from "./application/scheduler.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AiProcessorModule,
    GroupsModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
