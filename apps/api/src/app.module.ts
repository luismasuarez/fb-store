import { Module } from "@nestjs/common";
import { APP_PIPE, APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { AppController } from "./app.controller";
import { AppConfigModule } from "./infrastructure/config/app-config.module";
import { PrismaModule } from "./infrastructure/database/prisma/prisma.module";
import { QueueModule } from "./infrastructure/queue/queue.module";
import { ListingsModule } from "./features/listings/listings.module";
import { RawPostsModule } from "./features/raw-posts/raw-posts.module";
import { ScrapeModule } from "./features/scrape/scrape.module";
import { AiProcessorModule } from "./features/ai-processor/ai-processor.module";
import { GroupsModule } from "./features/groups/groups.module";
import { SchedulerModule } from "./features/scheduler/scheduler.module";
import { AuthModule } from "./features/auth/auth.module";
import { ZodValidationPipe } from "./core/pipes/zod-validation.pipe";
import { HttpExceptionFilter } from "./core/filters/http-exception.filter";
import { RequestIdInterceptor } from "./core/interceptors/request-id.interceptor";
import { ApiKeyGuard } from "./core/guards/api-key.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, "../../.env"), ".env"],
    }),
    AppConfigModule,
    PrismaModule,
    QueueModule,
    ListingsModule,
    RawPostsModule,
    ScrapeModule,
    AiProcessorModule,
    GroupsModule,
    SchedulerModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
