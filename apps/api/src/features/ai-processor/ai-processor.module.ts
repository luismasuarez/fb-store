import { Module } from "@nestjs/common";
import { AiProcessorController } from "./api/ai-processor.controller";
import { AiProcessorService } from "./application/ai-processor.service";

@Module({
  controllers: [AiProcessorController],
  providers: [AiProcessorService],
  exports: [AiProcessorService],
})
export class AiProcessorModule {}
