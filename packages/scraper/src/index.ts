import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.env.INIT_CWD || process.cwd(), ".env") });
import { getPrismaClient, sanitizeFacebookText } from "@fb-store/shared";
import { createContext } from "./browser";
import { EXTRACTOR_SCRIPT } from "./extractor";
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
    const url = `https://facebook.com/groups/${group.id}`;
    console.log(`🌐 ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(2000);
    }

    await page.evaluate(() => {
      const buttons = document.querySelectorAll<HTMLElement>('[role="button"]');
      for (const btn of buttons) {
        if (btn.textContent?.includes("Ver más")) {
          btn.click();
        }
      }
    });
    await page.waitForTimeout(1500);

    const extractFn = EXTRACTOR_SCRIPT;
    const raw = (await page.evaluate(extractFn)) as any;
    const posts: RawPost[] = Array.isArray(raw) ? raw : [];
    const valid = posts.filter(p => p.text.length > 20);
    console.log(`📦 ${valid.length} posts extraídos`);

    if (valid.length > 0) {
      console.log(`📝 Ejemplo: ${valid[0].text.substring(0, 150)}`);
    }

    return valid;
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
          textContent: sanitizeFacebookText(post.text).substring(0, 10000),
          processed: false,
        },
      });
      saved++;
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      console.error(`❌ Error: ${post.fbPostId}:`, err.message);
    }
  }
  console.log(`💾 ${saved} posts nuevos`);
  return saved;
}

async function main() {
  const profileDir = process.env.PROFILE_DIR ?? "./profiles/cuenta-1";
  const rawGroups = process.env.FB_GROUPS ?? "[]";
  const scrollDelay = Number(process.env.SCROLL_DELAY_MS) || 4000;

  const groups: GroupConfig[] = JSON.parse(rawGroups);
  if (!groups.length) {
    console.error("❌ FB_GROUPS vacío.");
    process.exit(1);
  }

  console.log(`🚀 Scraper — ${groups.length} grupo(s)`);

  for (const group of groups) {
    console.log(`\n--- ${group.name} ---`);
    try {
      const scrolls = Math.ceil(group.maxPosts / 5);
      const posts = await scrapeGroup(profileDir, group, scrolls, scrollDelay);
      await savePosts(posts, group.id);
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
  }

  console.log("\n🏁 Scraper finalizado");
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
