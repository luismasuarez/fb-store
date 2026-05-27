import { Module } from "@nestjs/common";
import { AiProcessorController } from "./ai-processor.controller";
import { AiProcessorService } from "./ai-processor.service";

@Module({
  controllers: [AiProcessorController],
  providers: [AiProcessorService],
})
export class AiProcessorModule {}
