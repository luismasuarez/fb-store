import { Module } from "@nestjs/common";
import { GroupsController } from "./api/groups.controller";
import { GroupsService } from "./application/groups.service";
import { GroupRepository } from "./infrastructure/group.repository";
import { PrismaModule } from "../../infrastructure/database/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupRepository],
  exports: [GroupsService],
})
export class GroupsModule {}
