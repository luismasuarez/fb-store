import { Controller, Post, Get, Body, Param, HttpCode, Res, Query } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { Readable } from "stream";
import { ScrapeService } from "../application/scrape.service";

interface ScrapeBody {
  groupId?: string;
  maxPosts?: number;
}

@Controller("api/scrape")
export class ScrapeController {
  constructor(private readonly scrapeService: ScrapeService) {}

  @Post()
  @HttpCode(202)
  async trigger(@Body() body: ScrapeBody) {
    return this.scrapeService.triggerScrape(body?.groupId, body?.maxPosts);
  }

  @Post("all")
  @HttpCode(202)
  async triggerAll() {
    return this.scrapeService.triggerScrapeForAllGroups();
  }

  @Get("active")
  async getActive(@Query("profile") profile?: string) {
    const active = await this.scrapeService.getActiveScrapeJob(profile ?? "cuenta-1");
    return { data: active };
  }


  @Get(":jobId/events")
  async streamEvents(
    @Param("jobId") jobId: string,
    @Res() reply: FastifyReply,
  ) {
    const scraperRes = await this.scrapeService.fetchJobEventsStream(jobId);
    if (!scraperRes) {
      return reply.status(404).send({
        statusCode: 404,
        message: `Job ${jobId} not found`,
        error: "Not Found",
      });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    const nodeStream = Readable.fromWeb(
      scraperRes.body as ReadableStream<Uint8Array>,
    );
    nodeStream.pipe(reply.raw);
  }
}
