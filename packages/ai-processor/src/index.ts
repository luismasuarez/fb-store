import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.env.INIT_CWD || process.cwd(), ".env") });
import { getPrismaClient, getProvider } from "@fb-store/shared";
import type { StructuredListing } from "@fb-store/shared";

const BATCH_SIZE = 10;

async function processPost(
  post: { id: string; textContent: string | null; fbPostId: string; groupId: string | null; rawData: any },
  provider: { extract(rawText: string): Promise<StructuredListing> },
): Promise<string | null> {
  const text = post.textContent || "";
  if (text.length < 20) {
    await getPrismaClient().rawPost.update({ where: { id: post.id }, data: { processed: true, aiProvider: "skipped" } });
    return null;
  }

  try {
    const result = await provider.extract(text);
    const prisma = getPrismaClient();

    await prisma.listing.create({
      data: {
        fbPostId: post.fbPostId,
        title: result.title,
        price: result.price,
        currency: result.currency || "Bs",
        category: result.category,
        description: result.description,
        contactPhone: result.contactPhone,
        contactName: result.contactName,
        location: result.location,
        status: result.isAvailable ? "active" : "sold",
        aiConfidence: result.confidence,
        rawText: text.substring(0, 10000),
        sourceGroupId: post.groupId,
        images: post.rawData?.images || [],
        rawPosts: { connect: { id: post.id } },
      },
    });

    await prisma.rawPost.update({
      where: { id: post.id },
      data: { processed: true, aiProvider: "openrouter" },
    });

    return post.fbPostId;
  } catch (err: any) {
    if (err?.code === "P2002") {
      await getPrismaClient().rawPost.update({
        where: { id: post.id },
        data: { processed: true, aiProvider: "duplicate" },
      });
      return null;
    }
    throw err;
  }
}

async function main() {
  const providerName = process.env.AI_PROVIDER || "openrouter";
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "openai/gpt-4o-mini";

  if (!apiKey) {
    console.error("❌ OPENROUTER_API_KEY o AI_API_KEY no configurada en .env");
    process.exit(1);
  }

  console.log(`🤖 AI Processor — provider=${providerName} model=${model}`);

  const provider = getProvider(providerName, apiKey, model);
  const prisma = getPrismaClient();

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalErrors = 0;

  while (true) {
    const posts = await prisma.rawPost.findMany({
      where: { processed: false },
      take: BATCH_SIZE,
      orderBy: { scrapedAt: "asc" },
    });

    if (!posts.length) {
      console.log("\n✅ No hay más posts sin procesar");
      break;
    }

    console.log(`\n📦 Lote de ${posts.length} posts...`);

    for (const post of posts) {
      const created = await processPost(post, provider).catch((err) => {
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
