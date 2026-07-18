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

export interface ScrapeMetrics {
  groupId: string;
  postsFound: number;
  postsNew: number;
  durationMs: number;
}

export async function scrapeGroup(
  profileDir: string,
  group: GroupConfig,
  maxScrolls: number,
  scrollDelayMs: number,
): Promise<RawPost[]> {
  const context = await createContext(profileDir);
  const page = await context.newPage();

  try {
    const url = `https://facebook.com/groups/${group.id}`;
    console.log(`🌐 ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);

    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(scrollDelayMs);
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
    const valid = posts.filter((p) => p.text.length > 20);
    console.log(`📦 ${valid.length} posts extraídos`);

    for (const post of valid) {
      if (post.images.length > 0) {
        const imgs: { url: string; mime: string; data: string }[] = [];
        for (const imgUrl of post.images) {
          try {
            const dataUrl = await page.evaluate(async (url) => {
              const res = await fetch(url);
              const blob = await res.blob();
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }, imgUrl);
            const [header, data] = dataUrl.split(",");
            imgs.push({
              url: imgUrl,
              mime: header.match(/data:(.*?);/)?.[1] || "image/jpeg",
              data,
            });
          } catch {
            imgs.push({ url: imgUrl, mime: "image/jpeg", data: "" });
          }
        }
        post.images = imgs as any;
      }
    }

    if (valid.length > 0) {
      console.log(`📝 Ejemplo: ${valid[0].text.substring(0, 150)}`);
    }

    return valid;
  } finally {
    await page.close();
    await context.close();
  }
}

export async function savePosts(
  posts: RawPost[],
  groupId: string,
): Promise<number> {
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

export async function saveScrapeLog(metrics: ScrapeMetrics): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.scrapeLog.create({
    data: {
      groupId: metrics.groupId,
      accountIndex: 0,
      postsFound: metrics.postsFound,
      postsNew: metrics.postsNew,
      postsErrors: 0,
      startedAt: new Date(Date.now() - metrics.durationMs),
      finishedAt: new Date(),
      durationMs: metrics.durationMs,
    },
  });
}

export async function main() {
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
      const startTime = Date.now();
      const posts = await scrapeGroup(profileDir, group, scrolls, scrollDelay);
      const postsNew = await savePosts(posts, group.id);
      await saveScrapeLog({
        groupId: group.id,
        postsFound: posts.length,
        postsNew,
        durationMs: Date.now() - startTime,
      });
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
  }

  console.log("\n🏁 Scraper finalizado");
}
