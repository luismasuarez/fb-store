import { config } from "dotenv";
import { resolve } from "path";
import fs from "fs";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import fastifyStatic from "@fastify/static";
import path from "path";
import { AppModule } from "./app.module";
import { AppConfigService } from "./infrastructure/config/app-config.service";

config({ path: resolve(__dirname, "../../../.env") });

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const appConfig = app.get(AppConfigService);
  appConfig.validateRequired();

  const adminDist = path.join(__dirname, "../../../apps/admin/dist");
  const indexHtml = fs.readFileSync(
    path.join(adminDist, "index.html"),
    "utf-8",
  );

  const fastifyInstance = app.getHttpAdapter().getInstance();

  fastifyInstance.register(fastifyStatic, {
    root: adminDist,
    wildcard: false,
  });

  fastifyInstance.addHook("onSend", (request, reply, payload, done) => {
    if (reply.statusCode === 404 && !request.url.startsWith("/api")) {
      reply.code(200).header("Content-Type", "text/html; charset=utf-8");
      return done(null, indexHtml);
    }
    return done(null, payload);
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("FB Store API")
    .setVersion("0.1")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(3000, "0.0.0.0");
}

bootstrap();
