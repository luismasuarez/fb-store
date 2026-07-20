import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.env.INIT_CWD || process.cwd(), ".env") });
import { getPrismaClient } from "./db";
import { sanitizeFacebookText } from "./sanitize";
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
  onProgress?: (phase: string, current: number, total: number) => void,
): Promise<RawPost[]> {
  const context = await createContext(profileDir);
  const page = await context.newPage();

  try {
    const url = `https://facebook.com/groups/${group.id}`;
    console.log(`🌐 ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    onProgress?.("navigating", 1, 1);

    for (let i = 0; i < maxScrolls; i++) {
      onProgress?.("scrolling", i + 1, maxScrolls);
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
    onProgress?.("extracting", 1, 1);

    // Open photo viewer for each post to capture all carousel images
    for (let i = 0; i < valid.length; i++) {
      const post = valid[i];
      if (!Array.isArray(post.images) || post.images.length === 0) continue;

      try {
        const postEl = page.locator('[role="feed"] [aria-posinset]').nth(i);
        const firstImg = postEl.locator('img[src*="scontent"]').first();
        if (await firstImg.count() === 0) continue;

        await firstImg.click({ timeout: 3000 });
        await page.waitForTimeout(1500);

        const urls = new Set<string>();
        let prevSrc = "";
        for (let n = 0; n < 50; n++) {
          const src = await page.evaluate(() => {
            const img = document.querySelector(
              '[role="dialog"] img[src*="scontent"], [role="presentation"] img[src*="scontent"]'
            );
            return (img as HTMLImageElement)?.src || "";
          });
          if (src) urls.add(src);
          if (n > 0 && src === prevSrc) break;
          prevSrc = src;
          await page.keyboard.press("ArrowRight");
          await page.waitForTimeout(600);
        }

        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);

        const allUrls = Array.from(urls);
        if (allUrls.length > post.images.length) {
          console.log(`📸 Post ${i}: ${post.images.length} → ${allUrls.length} imágenes`);
          post.images = allUrls;
        }
      } catch {
        // fallback: keep original images from feed extraction
      }
    }

    const totalImages = valid.reduce((sum, p) => sum + (Array.isArray(p.images) ? p.images.length : 0), 0);
    let imgCount = 0;
    for (const post of valid) {
      if (post.images.length > 0) {
        const imgs: { url: string; mime: string; data: string }[] = [];
        for (const imgUrl of post.images) {
          imgCount++;
          onProgress?.("downloading", imgCount, totalImages || 1);
          try {
            const response = await page.request.fetch(imgUrl);
            const buffer = await response.body();
            const mime = response.headers()["content-type"] || "image/jpeg";
            imgs.push({ url: imgUrl, mime, data: buffer.toString("base64") });
          } catch {
            console.warn(`⚠️ Falló descarga: ${imgUrl.substring(0, 60)}...`);
          }
        }
        post.images = imgs as any;
      }
    }

    if (valid.length > 0) {
      console.log(`📝 Ejemplo: ${valid[0].text.substring(0, 150)}`);
    }

    onProgress?.("saving", 1, 1);
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
  const scrollDelay = Number(process.env.SCROLL_DELAY_MS) || 4000;

  const prisma = getPrismaClient();
  const dbGroups = await prisma.group.findMany({ where: { isActive: true } });
  const groups: GroupConfig[] = dbGroups.map((g) => ({
    id: g.id,
    name: g.name,
    maxPosts: g.maxPosts,
  }));
  if (!groups.length) {
    console.error("❌ No hay grupos activos en la base de datos.");
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
