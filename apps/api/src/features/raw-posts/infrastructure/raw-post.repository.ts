import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database/prisma/prisma.service";

export interface RawPostsQuery {
  page: number;
  limit: number;
  status?: string;
  groupId?: string;
  scrapedAtGte?: string;
  scrapedAtLte?: string;
}

@Injectable()
export class RawPostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: RawPostsQuery) {
    const where: any = {};
    if (query.groupId) where.groupId = query.groupId;

    if (query.status === "pending") where.processed = false;
    else if (query.status === "processed") where.processed = true;
    else if (query.status === "skipped") where.aiProvider = "skipped";

    if (query.scrapedAtGte || query.scrapedAtLte) {
      where.scrapedAt = {};
      if (query.scrapedAtGte) where.scrapedAt.gte = new Date(query.scrapedAtGte);
      if (query.scrapedAtLte) where.scrapedAt.lte = new Date(query.scrapedAtLte);
    }

    const skip = (query.page - 1) * query.limit;

    const [data, total] = await Promise.all([
      this.prisma.client.rawPost.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { scrapedAt: "desc" },
        select: {
          id: true,
          fbPostId: true,
          groupId: true,
          textContent: true,
          processed: true,
          scrapedAt: true,
        },
      }),
      this.prisma.client.rawPost.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.client.rawPost.findUnique({
      where: { id },
    });
  }
}
