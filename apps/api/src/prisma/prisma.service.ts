import { Injectable, OnModuleInit } from "@nestjs/common";
import { getPrismaClient } from "@fb-store/shared";
import type { PrismaClient } from "@fb-store/shared";

@Injectable()
export class PrismaService implements OnModuleInit {
  public client: PrismaClient;

  constructor() {
    this.client = getPrismaClient() as unknown as PrismaClient;
  }

  async onModuleInit() {
    await this.client.$connect();
  }
}
