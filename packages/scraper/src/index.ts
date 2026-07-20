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

    // Open photo viewer + carousel to capture all images per post
    for (let i = 0; i < valid.length; i++) {
      const post = valid[i];
      if (!Array.isArray(post.images) || post.images.length === 0) continue;

      try {
        const postEl = page.locator('[role="feed"] [aria-posinset]').nth(i);
        const firstImg = postEl.locator('img[src*="scontent"]').first();
        if (await firstImg.count() === 0) continue;

        console.log(`📸 Post ${i}: ${post.images.length} imágenes iniciales, abriendo visor...`);

        // 1st click: open photo viewer
        await firstImg.click({ timeout: 5000 });
        await page.waitForTimeout(2000);

        // Debug: dump viewer DOM info
        const debugInfo = await page.evaluate(() => {
          const imgsInDialog = document.querySelectorAll(
            '[role="dialog"] img, [role="presentation"] img'
          );
          return {
            hasDialog: !!document.querySelector('[role="dialog"]'),
            hasPresentation: !!document.querySelector('[role="presentation"]'),
            imgCountInDialog: imgsInDialog.length,
            allRoles: Array.from(document.querySelectorAll("[role]"))
              .slice(0, 15)
              .map((el) => `${el.tagName}[role="${el.getAttribute("role")}"]`),
            viewerImgs: Array.from(imgsInDialog).slice(0, 3).map((img) => ({
              src: (img as HTMLImageElement).src?.substring(0, 100),
              w: (img as HTMLImageElement).offsetWidth,
              h: (img as HTMLImageElement).offsetHeight,
            })),
          };
        });
        console.log(`🔍 Visor: dialog=${debugInfo.hasDialog}, presentation=${debugInfo.hasPresentation}, imgs=${debugInfo.imgCountInDialog}`);
        console.log(`🔍 Roles: ${debugInfo.allRoles.join(", ")}`);
        if (debugInfo.viewerImgs.length > 0) {
          console.log(`🔍 1ra img: ${JSON.stringify(debugInfo.viewerImgs[0])}`);
        }

        // 2nd click on the image inside the viewer
        const clicked = await page.evaluate(() => {
          const selectors = [
            '[role="dialog"] img[src*="scontent"]',
            '[role="presentation"] img[src*="scontent"]',
            '[role="dialog"] img[src*="fbcdn"]',
          ];
          for (const sel of selectors) {
            const img = document.querySelector<HTMLElement>(sel);
            if (img) { img.click(); return sel; }
          }
          return "";
        });
        console.log(`📌 2do clic: selector="${clicked}"`);
        await page.waitForTimeout(2000);

        // Debug: check if the second click changed the DOM
        const after2nd = await page.evaluate(() => ({
          imgCount: document.querySelectorAll("img[src*='fbcdn']").length,
          roles: Array.from(document.querySelectorAll("[role]"))
            .slice(0, 10)
            .map((el) => `${el.tagName}[role="${el.getAttribute("role")}"]`),
        }));
        console.log(`🔍 Tras 2do clic: imgs=${after2nd.imgCount}, roles=${after2nd.roles.join(", ")}`);

        // Try extracting all images from the viewer DOM in one shot
        const allAtOnce = await page.evaluate(() => {
          const imgs = document.querySelectorAll<HTMLImageElement>("img[src*='fbcdn']");
          return Array.from(imgs).map((img) => img.src);
        });
        console.log(`📸 Post ${i}: todas las fbcdn en DOM: ${allAtOnce.length}`);

        // Navigate carousel to find unique URLs
        const urls = new Set<string>();
        let prevSrc = "";
        let stuckCount = 0;

        for (let n = 0; n < 50; n++) {
          const src = await page.evaluate(() => {
            for (const sel of [
              '[role="dialog"] img[src*="fbcdn"]',
              '[role="presentation"] img[src*="fbcdn"]',
              "img[src*='fbcdn']:not([width='0']):not([height='0'])",
            ]) {
              const img = document.querySelector<HTMLImageElement>(sel);
              if (img?.src && img.offsetWidth > 0) return img.src;
            }
            return "";
          });

          if (src) {
            urls.add(src);
            if (n === 0) console.log(`📸 Primera URL: ${src.substring(0, 100)}`);
          }

          if (n > 0) {
            if (src === prevSrc) {
              stuckCount++;
              if (stuckCount >= 3) break;
            } else {
              stuckCount = 0;
            }
          }
          prevSrc = src;

          await page.keyboard.press("ArrowRight");
          await page.waitForTimeout(600);
        }

        console.log(`📸 Post ${i}: ${urls.size} URLs con teclado`);

        // Try clicking nav buttons as fallback
        if (urls.size <= 2) {
          console.log(`📸 Post ${i}: pocas URLs, probando botones de navegación...`);
          for (let n = 0; n < 20; n++) {
            // Click next button
            await page.evaluate(() => {
              const btns = document.querySelectorAll<HTMLElement>(
                '[role="dialog"] a, [role="presentation"] a, [role="dialog"] [role="button"], [role="presentation"] [role="button"]'
              );
              for (const btn of Array.from(btns)) {
                const label = (btn.getAttribute("aria-label") || "").toLowerCase();
                const html = (btn.innerHTML || "").toLowerCase();
                if (
                  label.includes("next") || label.includes("siguiente") ||
                  label.includes("right") || label.includes("derecha") ||
                  html.includes("›") || html.includes("▶") || html.includes("▸")
                ) {
                  btn.click();
                  return;
                }
              }
              // fallback: click the right side of the viewport
              const rightEl = document.elementFromPoint(window.innerWidth - 100, window.innerHeight / 2);
              (rightEl as HTMLElement)?.click();
            });
            await page.waitForTimeout(800);

            const src = await page.evaluate(() => {
              const img = document.querySelector<HTMLImageElement>("img[src*='fbcdn']:not([width='0'])");
              return img?.src || "";
            });
            if (src) urls.add(src);
          }
          console.log(`📸 Post ${i}: ${urls.size} URLs con botones`);
        }

        // Close viewer
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1000);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);

        const allUrls = Array.from(urls).filter(Boolean);
        console.log(`📸 Post ${i}: total ${allUrls.length} URLs capturadas`);
        if (allUrls.length > post.images.length) {
          post.images = allUrls;
        } else {
          console.log(`📸 Post ${i}: no se encontraron más imágenes que las iniciales`);
        }
      } catch (err: any) {
        console.log(`⚠️ Post ${i}: error en carrusel: ${err.message}`);
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
