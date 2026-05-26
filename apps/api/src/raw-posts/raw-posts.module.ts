import { Module } from "@nestjs/common";
import { RawPostsController } from "./raw-posts.controller";
import { RawPostsService } from "./raw-posts.service";

@Module({
  controllers: [RawPostsController],
  providers: [RawPostsService],
  exports: [RawPostsService],
})
export class RawPostsModule {}
