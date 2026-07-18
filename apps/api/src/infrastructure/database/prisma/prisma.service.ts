import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@fb-store/shared";
import { getPrismaClient } from "@fb-store/shared";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public client!: PrismaClient;

  async onModuleInit() {
    this.client = getPrismaClient() as unknown as PrismaClient;
    await this.client.$connect();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.$disconnect();
    }
  }
}
