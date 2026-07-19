import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { ZodSchemaPipe } from "../../../core/pipes/zod-schema.pipe";
import { GroupsService } from "../application/groups.service";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";

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
  create(@Body(ZodSchemaPipe(CreateGroupDto)) dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.groupsService.findById(id);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body(ZodSchemaPipe(UpdateGroupDto)) dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.groupsService.delete(id);
  }
}
