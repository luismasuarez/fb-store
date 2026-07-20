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

    // Debug: show image info for each post
    for (let di = 0; di < valid.length; di++) {
      const p = valid[di];
      const dbg = (p as any)._debugImgs;
      if (Array.isArray(dbg)) {
        const totalInDOM = dbg.length;
        const visible = dbg.filter((x: any) => x.visible).length;
        const withFbcdn = dbg.filter((x: any) => x.src.includes("fbcdn") || x.dataSrc.includes("fbcdn")).length;
        console.log(`🔍 Post ${di}: total <img>=${totalInDOM}, visibles=${visible}, con fbcdn=${withFbcdn}, images[]=${p.images.length}`);
        if (totalInDOM > 0) {
          console.log(`🔍 Muestra:`, JSON.stringify(dbg.slice(0, 5), null, 2));
        }
      } else {
        console.log(`🔍 Post ${di}: sin _debugImgs, images[]=${p.images.length}`);
      }
    }

    onProgress?.("extracting", 1, 1);

    // Open photo viewer directly by URL to capture all album images
    for (let i = 0; i < valid.length; i++) {
      const post = valid[i];
      if (!Array.isArray(post.images) || post.images.length === 0) continue;
      if (!post.postUrl) {
        console.log(`📸 Post ${i}: sin postUrl, saltando visor`);
        continue;
      }

      console.log(`📸 Post ${i}: ${post.images.length} iniciales, abriendo visor vía URL...`);
      console.log(`📸   URL: ${post.postUrl.substring(0, 150)}`);

      try {
        const feedUrl = page.url();

        // Navigate directly to the photo URL to open the viewer
        console.log(`📸 Post ${i}: navegando a ${post.postUrl.substring(0, 80)}...`);
        await page.goto(post.postUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(3000);

        // Debug: log current URL and page structure
        const viewerUrl = page.url();
        console.log(`📸 Post ${i}: URL actual tras navegar: ${viewerUrl.substring(0, 120)}`);

        // Check what's on the page
        const pageInfo = await page.evaluate(() => ({
          title: document.title,
          imgsFbcdn: document.querySelectorAll("img[src*='fbcdn']").length,
          imgsAll: document.querySelectorAll("img").length,
          hasRoleDialog: !!document.querySelector('[role="dialog"]'),
          hasRolePresentation: !!document.querySelector('[role="presentation"]'),
          roles: Array.from(document.querySelectorAll("[role]"))
            .slice(0, 10)
            .map((el) => `${el.tagName}[role="${el.getAttribute("role")}"]`),
        }));
        console.log(`📸 Post ${i}: visor cargado — title="${pageInfo.title}", imgsFbcdn=${pageInfo.imgsFbcdn}, imgsAll=${pageInfo.imgsAll}, dialog=${pageInfo.hasRoleDialog}`);

        // Try to extract all images from the viewer page
        let urls: string[] = [];

        // Method 1: extract from current page DOM
        urls = await page.evaluate(() => {
          const imgs = document.querySelectorAll<HTMLImageElement>(
            "img[src*='fbcdn'], img[src*='scontent']"
          );
          return Array.from(imgs)
            .map((img) => img.src)
            .filter((s) => s && !s.startsWith("data:") && s.includes("/"));
        });
        console.log(`📸 Post ${i}: método 1 (DOM directo): ${urls.length} URLs`);

        // Method 2: try pressing ArrowRight and capturing new images
        if (urls.length <= 2) {
          console.log(`📸 Post ${i}: pocas URLs, navegando carrusel...`);
          const navUrls = new Set(urls);
          let prevSrc = "";
          let stuckCount = 0;

          for (let n = 0; n < 50; n++) {
            await page.keyboard.press("ArrowRight");
            await page.waitForTimeout(1000);

            const src = await page.evaluate(() => {
              const imgs = document.querySelectorAll<HTMLImageElement>(
                "img[src*='fbcdn']:not([width='0']):not([height='0'])"
              );
              if (imgs.length > 0) return imgs[imgs.length - 1].src;
              return "";
            });

            if (src && !src.startsWith("data:")) {
              if (navUrls.has(src)) {
                stuckCount++;
                if (stuckCount >= 3) {
                  console.log(`📸 Post ${n}: misma URL x3 — fin carrusel (${navUrls.size} URLs)`);
                  break;
                }
              } else {
                navUrls.add(src);
                stuckCount = 0;
                console.log(`📸   [${n}] Nueva URL: ${src.substring(0, 80)}`);
              }
              prevSrc = src;
            }

            // Also try ArrowLeft
            if (n % 2 === 1) {
              await page.keyboard.press("ArrowLeft");
              await page.waitForTimeout(600);
            }
          }

          urls = Array.from(navUrls);
          console.log(`📸 Post ${i}: después de navegación: ${urls.length} URLs`);
        }

        // Deduplicate and filter
        const uniqueUrls = Array.from(new Set(urls)).filter(
          (s) => s && !s.startsWith("data:") && !s.includes("svg")
        );
        console.log(`📸 Post ${i}: ${uniqueUrls.length} URLs únicas después de filtrar`);

        if (uniqueUrls.length > post.images.length) {
          console.log(`📸 Post ${i}: ${post.images.length} → ${uniqueUrls.length} imágenes ✅`);
          post.images = uniqueUrls;
        } else {
          console.log(`📸 Post ${i}: no se encontraron más imágenes (${post.images.length} ≥ ${uniqueUrls.length})`);
        }

        // Go back to the feed
        console.log(`📸 Post ${i}: volviendo al feed...`);
        await page.goto(feedUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(2000);
        console.log(`📸 Post ${i}: de vuelta al feed`);
      } catch (err: any) {
        console.log(`⚠️ Post ${i}: error en visor: ${err.message}`);
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
