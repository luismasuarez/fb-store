import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.env.INIT_CWD || process.cwd(), ".env") });
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
    console.log(`📁 Perfil usado: ${profileDir}`);

    const cookiesBefore = await context.cookies();
    console.log(`🍪 Cookies antes: ${cookiesBefore.length}`);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    await page.waitForTimeout(2000);

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(2000);
    }

    await page.waitForTimeout(3000);

    const cookiesAfter = await context.cookies();
    console.log(`🍪 Cookies: ${cookiesAfter.length}`);
    const fbCookie = cookiesAfter.find(c => c.name === "c_user" || c.name === "xs");
    console.log(`🔑 Sesión FB: ${fbCookie ? fbCookie.name + "=" + fbCookie.value.substring(0, 10) + "..." : "NO"}`);

    const pageContent = await page.evaluate(() => {
      const feed = document.querySelector('[role="feed"]');
      if (!feed) return { error: "no feed" };
      const posts = feed.querySelectorAll('[aria-posinset]');
      const postData = Array.from(posts).slice(0, 3).map(el => {
        const fullHtml = el.innerHTML.substring(0, 2000);
        const text = (el.textContent || "").substring(0, 500);
        const imgs = Array.from(el.querySelectorAll('img')).map(i => i.src).filter(s => s.includes("scontent"));
        return {
          posinset: el.getAttribute("aria-posinset"),
          isVirtualized: el.closest('[data-virtualized="true"]') !== null,
          text,
          images: imgs.length,
          imgSrcs: imgs.slice(0, 2),
          html: fullHtml,
        };
      });
      return {
        feedChildren: feed.children.length,
        ariaPosinset: posts.length,
        samples: postData,
      };
    });
    console.log(`📄 Posts en feed: ${JSON.stringify(pageContent, null, 2)}`);

    const totalScrolls = maxScrolls + 5;
    const script = buildExtractorScript(totalScrolls, scrollDelayMs);
    const posts = (await page.evaluate(script)) as RawPost[];

    const nonEmpty = posts.filter(p => p.text.trim().length > 10);
    console.log(`📦 Extraídos ${posts.length} posts (${nonEmpty.length} con texto)`);
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
