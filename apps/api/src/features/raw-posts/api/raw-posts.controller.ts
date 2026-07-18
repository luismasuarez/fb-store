import { Controller, Get, Param, Query } from "@nestjs/common";
import { RawPostsService } from "../application/raw-posts.service";

@Controller("api/raw-posts")
export class RawPostsController {
  constructor(private readonly rawPostsService: RawPostsService) {}

  @Get()
  async findAll(@Query() query: any) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Math.min(Number(query.limit), 100) : 20;

    return this.rawPostsService.findAll({
      page,
      limit,
      groupId: query.group_id,
      status: query.status,
      scrapedAtGte: query["scrapedAt[gte]"],
      scrapedAtLte: query["scrapedAt[lte]"],
    });
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.rawPostsService.findOne(id);
  }
}
