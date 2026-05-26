import { getPrismaClient } from "@fb-store/shared";

export interface RawPostRow {
  id: string;
  fbPostId: string;
  textContent: string | null;
  groupId: string | null;
  rawData: any;
  scrapedAt: Date;
}

export async function getPendingPosts(batchSize: number): Promise<RawPostRow[]> {
  const prisma = getPrismaClient();
  return prisma.rawPost.findMany({
    where: { processed: false },
    take: batchSize,
    orderBy: { scrapedAt: "asc" },
  });
}

export async function markSkipped(postId: string): Promise<void> {
  await getPrismaClient().rawPost.update({
    where: { id: postId },
    data: { processed: true, aiProvider: "skipped" },
  });
}

export async function markDuplicate(postId: string): Promise<void> {
  await getPrismaClient().rawPost.update({
    where: { id: postId },
    data: { processed: true, aiProvider: "duplicate" },
  });
}

export async function markProcessed(postId: string): Promise<void> {
  await getPrismaClient().rawPost.update({
    where: { id: postId },
    data: { processed: true, aiProvider: "openrouter" },
  });
}

export async function createListing(data: any): Promise<string> {
  const prisma = getPrismaClient();
  const listing = await prisma.listing.create({ data });
  return listing.id;
}

export async function updateListingImages(listingId: string, images: any): Promise<void> {
  await getPrismaClient().listing.update({
    where: { id: listingId },
    data: { images },
  });
}
