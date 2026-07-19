import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database/prisma/prisma.service";

export interface AuthSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    return this.prisma.client.authSession.findUnique({
      where: { tokenHash },
    });
  }

  async create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<AuthSession> {
    return this.prisma.client.authSession.create({ data });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.client.authSession.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async findActiveByUser(userId: string): Promise<AuthSession | null> {
    return this.prisma.client.authSession.findFirst({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
