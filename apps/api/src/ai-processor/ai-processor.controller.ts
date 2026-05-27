import { Controller, Post } from "@nestjs/common";
import { AiProcessorService } from "./ai-processor.service";

@Controller("api/ai-process")
export class AiProcessorController {
  constructor(private readonly aiProcessorService: AiProcessorService) {}

  @Post()
  async run() {
    return this.aiProcessorService.run();
  }
}
