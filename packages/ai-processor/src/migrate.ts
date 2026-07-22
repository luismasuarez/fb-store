import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../../scraper/src/generated/prisma/client"

let client: PrismaClient | null = null

function getClient(): PrismaClient {
  if (!client) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    })
    client = new PrismaClient({ adapter })
  }
  return client
}

export async function migrateSoldListings(): Promise<{ migrated: number; skipped: number }> {
  const db = getClient()
  const cutoffDate = new Date("2026-07-21")

  const soldListings = await db.listing.findMany({
    where: {
      status: "sold",
      createdAt: { lt: cutoffDate },
    },
  })

  let migrated = 0
  let skipped = 0

  for (const listing of soldListings) {
    const aiRawData = listing.aiRawData as Record<string, unknown> | null
    const propertyType = (listing.propertyType ?? aiRawData?.propertyType ?? "") as string

    if (propertyType.toLowerCase() === "otro") {
      await db.listing.update({
        where: { id: listing.id },
        data: { status: "rejected" },
      })
      migrated++
    } else {
      await db.listing.update({
        where: { id: listing.id },
        data: { status: "review" },
      })
      migrated++
    }
  }

  return { migrated, skipped }
}

if (require.main === module) {
  migrateSoldListings()
    .then((result) => {
      console.log(JSON.stringify({ level: "info", msg: "Migration complete", ...result }))
      process.exit(0)
    })
    .catch((err) => {
      console.error(JSON.stringify({ level: "error", msg: "Migration failed", error: String(err) }))
      process.exit(1)
    })
}
