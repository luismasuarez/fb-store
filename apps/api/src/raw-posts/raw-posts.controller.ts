import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { RawPostsService } from "./raw-posts.service";

@Controller("api/raw-posts")
export class RawPostsController {
  constructor(private readonly rawPostsService: RawPostsService) {}

  @Get()
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("group_id") groupId?: string,
    @Query("processed") processed?: string,
  ) {
    return this.rawPostsService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      groupId,
      processed: processed !== undefined ? processed === "true" : undefined,
    });
  }

  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.rawPostsService.findOne(id);
  }
}
