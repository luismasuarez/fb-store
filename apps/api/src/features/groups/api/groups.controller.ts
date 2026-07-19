import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../../core/pipes/zod-validation.pipe";
import { SkipAuth } from "../../../core/guards/api-key.guard";
import { JwtAuthGuard } from "../../auth/api/jwt-auth.guard";
import { GroupsService } from "../application/groups.service";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";

@SkipAuth()
@Controller("api/groups")
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.groupsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body(new ZodValidationPipe(CreateGroupDto)) dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findById(@Param("id") id: string) {
    return this.groupsService.findById(id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  update(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateGroupDto)) dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  delete(@Param("id") id: string) {
    return this.groupsService.delete(id);
  }
}
