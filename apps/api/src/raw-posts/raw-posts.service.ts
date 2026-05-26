import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RawPostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    groupId?: string;
    processed?: boolean;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.groupId) where.groupId = params.groupId;
    if (params.processed !== undefined) where.processed = params.processed;

    const [data, total] = await Promise.all([
      this.prisma.client.rawPost.findMany({
        where,
        skip,
        take: limit,
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

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    return this.prisma.client.rawPost.findUnique({
      where: { id },
    });
  }
}
