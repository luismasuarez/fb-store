import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../../scraper/src/generated/prisma/client"
import type { StructuredPropertyListing } from "@fb-store/shared"

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

export interface ListingData {
  fbPostId: string
  title?: string
  price?: number
  currency: string
  category?: string
  description?: string
  contactPhone?: string
  contactName?: string
  location?: string
  images: any[]
  sourceGroup?: string
  sourceGroupId?: string
  sourceUrl?: string
  rawText?: string
  status: string
  aiConfidence?: number
  listingType?: string
  propertyType?: string
  summaryShort?: string
  province?: string
  municipality?: string
  neighborhood?: string
  bedrooms?: number
  bathrooms?: number
  totalM2?: number
  floors?: number
  parking?: boolean
  furnished?: boolean
  aiRawData?: any
}

export async function getPendingPosts(batchSize: number): Promise<any[]> {
  const db = getClient()
  return db.rawPost.findMany({
    where: { processed: false },
    take: batchSize,
    orderBy: { scrapedAt: "asc" },
  })
}

export async function markProcessed(postId: string, listingId: string): Promise<void> {
  const db = getClient()
  await db.rawPost.update({
    where: { id: postId },
    data: { processed: true, listingId, aiProvider: "openrouter" },
  })
}

export async function markDuplicate(postId: string): Promise<void> {
  const db = getClient()
  await db.rawPost.update({
    where: { id: postId },
    data: { processed: true },
  })
}

export async function createListing(data: ListingData): Promise<{ id: string }> {
  const db = getClient()
  return db.listing.create({ data: data as any }) as any
}

export async function updateListingImages(id: string, images: any[]): Promise<void> {
  const db = getClient()
  await db.listing.update({
    where: { id },
    data: { images },
  })
}

export async function getAiConfigRow(): Promise<any> {
  return getAiConfig()
}
