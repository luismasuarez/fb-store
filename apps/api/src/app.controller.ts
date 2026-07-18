import { Controller, Get } from "@nestjs/common";
import { SkipAuth } from "./core/guards/api-key.guard";

@Controller()
export class AppController {
  @SkipAuth()
  @Get("api/health")
  health() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
