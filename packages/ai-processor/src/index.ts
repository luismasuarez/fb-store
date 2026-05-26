import { getPrismaClient } from "@fb-store/shared";
import { loadConfig } from "./config";
import { createExtractor } from "./extractor";
import { mapToListing } from "./mapper";
import { downloadImagesAsBase64 } from "./image-downloader";
import * as db from "./db";

async function processPost(
  post: db.RawPostRow,
  extractor: { extract(text: string): Promise<any> },
): Promise<string | null> {
  const text = post.textContent || "";
  if (text.length < 20) {
    await db.markSkipped(post.id);
    return null;
  }

  try {
    const r = await extractor.extract(text);
    const data = mapToListing(r, post);
    const listingId = await db.createListing(data);

    const imagesData = await downloadImagesAsBase64(post.rawData?.images || []);
    if (imagesData.some((img) => img.data)) {
      await db.updateListingImages(listingId, imagesData);
    }

    await db.markProcessed(post.id);
    return post.fbPostId;
  } catch (err: any) {
    if (err?.code === "P2002") {
      await db.markDuplicate(post.id);
      return null;
    }
    throw err;
  }
}

async function main() {
  const cfg = loadConfig();
  console.log(`🤖 AI Processor — provider=${cfg.providerName} model=${cfg.model}`);

  const extractor = createExtractor(cfg.providerName, cfg.apiKey, cfg.model);
  getPrismaClient();

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalErrors = 0;

  while (true) {
    const posts = await db.getPendingPosts(cfg.batchSize);
    if (!posts.length) {
      console.log("\n✅ No hay más posts sin procesar");
      break;
    }

    console.log(`\n📦 Lote de ${posts.length} posts...`);

    for (const post of posts) {
      const created = await processPost(post, extractor).catch((err) => {
        console.error(`❌ Error post ${post.fbPostId}:`, err.message);
        totalErrors++;
        return null;
      });
      if (created) totalCreated++;
      totalProcessed++;
    }

    console.log(`   → procesados: ${totalProcessed} | listings: ${totalCreated} | errores: ${totalErrors}`);
  }

  console.log(`\n🏁 AI Processor finalizado`);
  console.log(`   ${totalProcessed} posts procesados`);
  console.log(`   ${totalCreated} listings creados`);
  console.log(`   ${totalErrors} errores`);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
