import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database/prisma/prisma.service";
import type { CreateGroupDto } from "../api/dto/create-group.dto";
import type { UpdateGroupDto } from "../api/dto/update-group.dto";

export interface Group {
  id: string;
  name: string;
  url: string | null;
  maxPosts: number;
  lastScraped: Date | null;
  lastError: string | null;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class GroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20): Promise<{ data: Group[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.client.group.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.client.group.count(),
    ]);
    return { data, total };
  }

  async findById(id: string): Promise<Group | null> {
    return this.prisma.client.group.findUnique({ where: { id } });
  }

  async findByUrl(url: string): Promise<Group | null> {
    return this.prisma.client.group.findFirst({ where: { url } });
  }

  async create(dto: CreateGroupDto): Promise<Group> {
    return this.prisma.client.group.create({
      data: {
        id: dto.id,
        name: dto.name,
        url: dto.url,
        maxPosts: dto.maxPosts ?? 30,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateGroupDto): Promise<Group> {
    return this.prisma.client.group.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.client.group.delete({ where: { id } });
  }
}
