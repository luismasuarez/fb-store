import { getPrismaClient } from "@fb-store/shared";
import { createContext } from "./browser";
import { EXTRACTOR_SCRIPT, buildExtractorScript } from "./extractor";
import type { RawPost } from "./extractor";

interface GroupConfig {
  id: string;
  name: string;
  maxPosts: number;
}

async function scrapeGroup(
  profileDir: string,
  group: GroupConfig,
  maxScrolls: number,
  scrollDelayMs: number
): Promise<RawPost[]> {
  const context = await createContext(profileDir);
  const page = await context.newPage();

  try {
    await page.addInitScript(EXTRACTOR_SCRIPT);

    const url = `https://facebook.com/groups/${group.id}`;
    console.log(`🌐 Navegando a: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(3000);

    const script = buildExtractorScript(maxScrolls, scrollDelayMs);
    const posts = (await page.evaluate(script)) as RawPost[];

    console.log(`📦 Extraídos ${posts.length} posts`);
    return posts;
  } finally {
    await page.close();
    await context.close();
  }
}

async function savePosts(posts: RawPost[], groupId: string) {
  const prisma = getPrismaClient();
  let saved = 0;
  for (const post of posts) {
    try {
      await prisma.rawPost.create({
        data: {
          fbPostId: post.fbPostId,
          groupId,
          rawData: post as unknown as any,
          textContent: post.text.substring(0, 10000),
          processed: false,
        },
      });
      saved++;
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      console.error(`❌ Error: ${post.fbPostId}:`, err.message);
    }
  }
  console.log(`💾 Guardados ${saved} posts nuevos`);
  return saved;
}

async function main() {
  const profileDir = process.env.PROFILE_DIR ?? "./profiles/cuenta-1";
  const rawGroups = process.env.FB_GROUPS ?? "[]";
  const scrollDelay = Number(process.env.SCROLL_DELAY_MS) || 4000;
  const maxScrolls = Number(process.env.MAX_SCROLLS) || 10;

  const groups: GroupConfig[] = JSON.parse(rawGroups);
  if (!groups.length) {
    console.error("❌ FB_GROUPS vacío. Define al menos un grupo en .env");
    process.exit(1);
  }

  console.log(`🚀 Scraper iniciando — ${groups.length} grupo(s)`);

  for (const group of groups) {
    console.log(`\n--- ${group.name} (${group.id}) ---`);
    try {
      const scrolls = Math.ceil(group.maxPosts / 5);
      const posts = await scrapeGroup(profileDir, group, scrolls, scrollDelay);
      await savePosts(posts, group.id);
    } catch (err: any) {
      console.error(`❌ Error en ${group.name}:`, err.message);
    }
  }

  console.log("\n🏁 Scraper finalizado");
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
