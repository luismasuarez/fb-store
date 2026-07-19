import { Controller, Get, Put, Body, BadRequestException, UseGuards } from "@nestjs/common";
import { SchedulerService } from "../application/scheduler.service";
import { JwtAuthGuard } from "../../auth/api/jwt-auth.guard";
import { SkipAuth } from "../../../core/guards/api-key.guard";

interface ScheduleUpdateBody {
  intervalMinutes?: number;
  hourStart?: number;
  hourEnd?: number;
  enabled?: boolean;
}

@SkipAuth()
@Controller("api/schedule")
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get()
  getSchedule() {
    return { data: this.schedulerService.getSchedule() };
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  async updateSchedule(@Body() body: ScheduleUpdateBody) {
    try {
      const updated = await this.schedulerService.updateSchedule(body);
      return { data: updated };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }
}
