import { Module } from "@nestjs/common";
import { RawPostsController } from "./api/raw-posts.controller";
import { RawPostsService } from "./application/raw-posts.service";
import { RawPostRepository } from "./infrastructure/raw-post.repository";

@Module({
  controllers: [RawPostsController],
  providers: [RawPostsService, RawPostRepository],
})
export class RawPostsModule {}
