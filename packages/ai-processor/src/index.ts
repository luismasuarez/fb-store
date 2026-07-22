import { Extractor } from "@fb-store/shared"
import type { ClassificationResult, StructuredPropertyListing } from "@fb-store/shared"
import { getAiConfig, reloadAiConfig } from "./config"
import { getPendingPosts, markProcessed, markDuplicate, createListing, updateListingImages, getGroupConfig, type ListingData } from "./db"
import { cleanPostText } from "./cleaner"
import { classifyPost } from "./classifier"
import { routeClassification, classificationToStatus, type RoutingDecision } from "./router"
import { downloadImagesAsBase64, type DownloadedImage } from "./image-downloader"

const POLL_INTERVAL_MS = 10_000
const MIN_TEXT_LENGTH = 20

function parsePrice(price: string | undefined): number | null {
  if (!price) return null
  const cleaned = price.replace(/[^0-9.]/g, "")
  const num = Number.parseFloat(cleaned)
  return Number.isNaN(num) ? null : num
}

function detectCurrency(price: string | undefined): string {
  if (!price) return "CUP"
  const upper = price.toUpperCase()
  if (upper.includes("USD")) return "USD"
  if (upper.includes("MLC")) return "MLC"
  if (upper.includes("EUR")) return "EUR"
  return "CUP"
}

function parseArea(area: string | undefined): number | null {
  if (!area) return null
  const cleaned = area.replace(/[^0-9.]/g, "")
  const num = Number.parseFloat(cleaned)
  return Number.isNaN(num) ? null : Math.round(num)
}

function aiResultToListingData(ai: StructuredPropertyListing, post: any): ListingData {
  const price = parsePrice(ai.price)
  const confidence = ai.confidenceScore ?? 0
  return {
    fbPostId: post.fbPostId,
    title: ai.title?.slice(0, 255),
    price: price ?? undefined,
    currency: detectCurrency(ai.price),
    description: ai.descriptionClean?.slice(0, 5000),
    category: ai.propertyType === "otro" ? "general" : "inmuebles",
    contactPhone: ai.contact?.phone?.slice(0, 50),
    contactName: ai.contact?.name?.slice(0, 100),
    location: [ai.location?.province, ai.location?.municipality, ai.location?.neighborhood]
      .filter(Boolean)
      .join(", "),
    images: [],
    sourceGroup: post.groupId,
    sourceGroupId: post.groupId,
    sourceUrl: post.rawData?.postUrl,
    rawText: post.textContent?.slice(0, 10000),
    status: confidence >= 0.3 ? "active" : "sold",
    aiConfidence: confidence,
    listingType: ai.listingType,
    propertyType: ai.propertyType,
    summaryShort: ai.summaryShort?.slice(0, 500),
    province: ai.location?.province,
    municipality: ai.location?.municipality,
    neighborhood: ai.location?.neighborhood,
    bedrooms: ai.propertyDetails?.bedrooms ?? undefined,
    bathrooms: ai.propertyDetails?.bathrooms ?? undefined,
    totalM2: parseArea(ai.propertyDetails?.totalArea),
    floors: ai.propertyDetails?.floors ?? undefined,
    parking: ai.features?.some((f) => /parqueo|garage|estacionamiento/i.test(f)) ?? false,
    furnished: ai.features?.some((f) => /amueblado|mueblado|equipado/i.test(f)) ?? false,
    aiRawData: ai,
  }
}

function makeMinimalListingData(post: any, text: string, result: ClassificationResult, status: string) {
  return {
    fbPostId: post.fbPostId,
    title: text.slice(0, 255),
    description: text.slice(0, 5000),
    images: [],
    sourceGroup: post.groupId,
    sourceGroupId: post.groupId,
    sourceUrl: post.rawData?.postUrl,
    rawText: text.slice(0, 10000),
    status,
    aiConfidence: result.confidence,
    category: "inmuebles",
    aiRawData: result,
  }
}

async function runExtraction(text: string, config: ReturnType<typeof getAiConfig>, post: any) {
  const extractor = new Extractor(config.provider, config.apiKey, config.model)
  const aiResult = await extractor.extract(text)
  return { aiResult, listingData: aiResultToListingData(aiResult, post) }
}

export async function processPost(post: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = getAiConfig()
    const text = cleanPostText(post.textContent || post.rawData?.text || "")

    if (text.length < MIN_TEXT_LENGTH) {
      const rawImages: any[] = Array.isArray(post.rawData?.images) ? post.rawData!.images : []
      if (rawImages.length > 0) {
        const classification: ClassificationResult = {
          contentType: "rejected",
          confidence: 0,
          reasoning: "Image-only post — no text to classify",
          detectedEntities: [],
        }
        const listingData = makeMinimalListingData(post, text, classification, "review")
        const listing = await createListing(listingData)
        await markProcessed(post.id, listing.id)
        return { ok: true }
      }
      await markDuplicate(post.id)
      return { ok: true }
    }

    const groupConfig = await getGroupConfig(post.groupId)
    const classification = await classifyPost(text, config.apiKey, config.classifierModel)
    const decision: RoutingDecision = routeClassification(classification, {
      rejectThreshold: groupConfig?.rejectThreshold ?? 0.2,
      classifyThreshold: groupConfig?.classifyThreshold ?? 0.5,
      groupPurpose: groupConfig?.purpose ?? null,
    })

    const startTime = Date.now()
    let listingData: any
    let needsImages = false

    if (decision === "rejected") {
      listingData = makeMinimalListingData(post, text, classification, "rejected")
    } else {
      needsImages = true
      const { aiResult, listingData: mapped } = await runExtraction(text, config, post)
      listingData = mapped

      if (decision === "review") {
        listingData.status = "review"
      } else {
        listingData.status = "active"
      }
      listingData.aiConfidence = classification.confidence

      if (aiResult.confidenceScore < 0.3 && classification.confidence > 0.5) {
        listingData.status = "review"
      }
    }

    const processingTime = Date.now() - startTime

    console.log(JSON.stringify({
      level: "info",
      msg: "Post processed",
      postId: post.id,
      contentType: classification.contentType,
      confidence: classification.confidence,
      decision,
      status: listingData.status,
      processingTime,
    }))

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

    if (needsImages) {
      const postRawData = post.rawData || {}
      const rawImages: any[] = Array.isArray(postRawData.images) ? postRawData.images : []

      const existingImages: DownloadedImage[] = rawImages
        .filter((img: any) => img?.data)
        .map((img: any) => ({ url: img.url, mime: img.mime, data: img.data }))

      const pendingUrls: string[] = rawImages
        .filter((img: any) => !img?.data)
        .map((img: any) => (typeof img === "string" ? img : img.url))
        .filter(Boolean)

      if (existingImages.length > 0 || pendingUrls.length > 0) {
        const downloaded = pendingUrls.length > 0 ? await downloadImagesAsBase64(pendingUrls) : []
        await updateListingImages(listing.id, [...existingImages, ...downloaded])
      }
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
    if (result.ok) {
      processed++
    } else {
      errors++
      console.error(JSON.stringify({
        level: "error",
        msg: "Failed to process post",
        postId: post.id,
        fbPostId: post.fbPostId,
        error: result.error,
      }))
    }
  }

  return { processed, errors }
}

export async function main(): Promise<void> {
  const startupConfig = getAiConfig()
  console.log(JSON.stringify({
    level: "info",
    msg: "AI Processor started",
    pollIntervalMs: POLL_INTERVAL_MS,
    provider: startupConfig.provider,
    model: startupConfig.model,
    classifierModel: startupConfig.classifierModel,
    hasApiKey: !!startupConfig.apiKey,
  }))

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
