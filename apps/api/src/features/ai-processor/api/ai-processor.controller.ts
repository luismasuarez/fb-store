import { Controller, Post, Body, HttpCode, UseGuards } from "@nestjs/common";
import { AiProcessorService } from "../application/ai-processor.service";
import { JwtAuthGuard } from "../../auth/api/jwt-auth.guard";
import { SkipAuth } from "../../../core/guards/api-key.guard";

interface AiProcessBody {
  rawPostIds?: string[];
}

@SkipAuth()
@Controller("api/ai-process")
export class AiProcessorController {
  constructor(private readonly aiProcessorService: AiProcessorService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(202)
  async trigger(@Body() body: AiProcessBody) {
    return this.aiProcessorService.triggerProcessing(body?.rawPostIds);
  }
}
