import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

let client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!client) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    });
    client = new PrismaClient({ adapter });
  }
  return client;
}
