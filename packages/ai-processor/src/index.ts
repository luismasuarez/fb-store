import { Extractor } from "@fb-store/shared"
import { getAiConfig, reloadAiConfig } from "./config"
import { getPendingPosts, markProcessed, markDuplicate, createListing, updateListingImages } from "./db"
import { cleanPostText } from "./cleaner"
import { mapToListing } from "./mapper"
import { downloadImagesAsBase64 } from "./image-downloader"

const POLL_INTERVAL_MS = 10_000
const MIN_TEXT_LENGTH = 20

export async function processPost(post: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = getAiConfig()
    const text = cleanPostText(post.textContent || post.rawData?.text || "")
    if (text.length < MIN_TEXT_LENGTH) {
      await markDuplicate(post.id)
      return { ok: true }
    }

    const extractor = new Extractor(config.provider, config.apiKey, config.model)
    const aiResult = await extractor.extract(text)
    const listingData = mapToListing(aiResult, post)

    let listing: any
    try {
      listing = await createListing(listingData)
    } catch (err: any) {
      if (err?.code === "P2002") {
        await markDuplicate(post.id)
        return { ok: true }
      }
      throw err
    }

    const postRawData = post.rawData || {}
    const imageUrls: string[] = Array.isArray(postRawData.images)
      ? postRawData.images.map((img: any) => (typeof img === "string" ? img : img.url)).filter(Boolean)
      : []

    if (imageUrls.length > 0) {
      const images = await downloadImagesAsBase64(imageUrls)
      await updateListingImages(listing.id, images)
    }

    await markProcessed(post.id, listing.id)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function processBatch(): Promise<{ processed: number; errors: number }> {
  const config = getAiConfig()
  const posts = await getPendingPosts(config.batchSize)
  if (posts.length === 0) return { processed: 0, errors: 0 }

  let processed = 0
  let errors = 0

  for (const post of posts) {
    const result = await processPost(post)
    if (result.ok) processed++
    else errors++
  }

  return { processed, errors }
}

export async function main(): Promise<void> {
  console.log(JSON.stringify({ level: "info", msg: "AI Processor started", pollIntervalMs: POLL_INTERVAL_MS }))

  while (true) {
    try {
      reloadAiConfig()
      const result = await processBatch()
      if (result.processed > 0 || result.errors > 0) {
        console.log(JSON.stringify({ level: "info", msg: "Batch complete", ...result }))
      }
    } catch (err: any) {
      console.error(JSON.stringify({ level: "error", msg: err.message }))
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
