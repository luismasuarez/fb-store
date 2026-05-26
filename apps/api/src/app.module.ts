import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { RawPostsModule } from "./raw-posts/raw-posts.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RawPostsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
