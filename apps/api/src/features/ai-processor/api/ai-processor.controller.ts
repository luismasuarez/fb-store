import { Controller, Post, Body, HttpCode } from "@nestjs/common";
import { AiProcessorService } from "../application/ai-processor.service";

interface AiProcessBody {
  rawPostIds?: string[];
}

@Controller("api/ai-process")
export class AiProcessorController {
  constructor(private readonly aiProcessorService: AiProcessorService) {}

  @Post()
  @HttpCode(202)
  async trigger(@Body() body: AiProcessBody) {
    return this.aiProcessorService.triggerProcessing(body?.rawPostIds);
  }
}
