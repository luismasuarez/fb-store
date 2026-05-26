import { Injectable, OnModuleInit } from "@nestjs/common";
import { getPrismaClient } from "@fb-store/shared";
import type { PrismaClient } from "@fb-store/shared";

@Injectable()
export class PrismaService implements OnModuleInit {
  public client!: PrismaClient;

  async onModuleInit() {
    this.client = getPrismaClient() as unknown as PrismaClient;
    await this.client.$connect();
  }
}
