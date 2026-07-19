import { config } from "dotenv";
import { resolve } from "path";
import { getPrismaClient } from "@fb-store/shared";
import { randomBytes, scryptSync } from "crypto";

config({ path: resolve(__dirname, "../../../.env") });

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:16384:8:1:${salt.toString("hex")}:${key.toString("hex")}`;
}

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD env vars");
    process.exit(1);
  }

  const prisma = getPrismaClient();
  await prisma.$connect();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    await prisma.$disconnect();
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      displayName: "Admin",
    },
  });

  console.log(`Admin user created: ${email}`);
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
