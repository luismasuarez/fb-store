import { Controller, Get, Put, Body, BadRequestException } from "@nestjs/common";
import { SchedulerService } from "../application/scheduler.service";

interface ScheduleUpdateBody {
  intervalMinutes?: number;
  hourStart?: number;
  hourEnd?: number;
  enabled?: boolean;
}

@Controller("api/schedule")
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get()
  getSchedule() {
    return { data: this.schedulerService.getSchedule() };
  }

  @Put()
  async updateSchedule(@Body() body: ScheduleUpdateBody) {
    try {
      const updated = await this.schedulerService.updateSchedule(body);
      return { data: updated };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }
}
