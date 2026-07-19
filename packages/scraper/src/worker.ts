import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.env.INIT_CWD || process.cwd(), ".env") });
import { Worker, Queue } from "bullmq";
import { getPrismaClient } from "@fb-store/shared";
import { scrapeGroup, savePosts, saveScrapeLog } from "./index";
import type { ScrapeMetrics } from "./index";

interface ScrapeJobData {
  groupId?: string;
  maxPosts?: number;
}

interface GroupConfig {
  id: string;
  name: string;
  maxPosts: number;
}

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};
const bullPrefix = process.env.BULL_PREFIX || "{fb-store}";

const aiQueue = new Queue("ai-process", { connection, prefix: bullPrefix });
const prisma = getPrismaClient();

const worker = new Worker<ScrapeJobData>(
  "scrape",
  async (job) => {
    const profileDir = process.env.PROFILE_DIR ?? "./profiles/cuenta-1";
    const scrollDelay = Number(process.env.SCROLL_DELAY_MS) || 4000;

    const dbGroups = await prisma.group.findMany({ where: { isActive: true } });
    const groups: GroupConfig[] = dbGroups.map((g) => ({
      id: g.id,
      name: g.name,
      maxPosts: g.maxPosts,
    }));
    const targetGroups = job.data.groupId
      ? groups.filter((g) => g.id === job.data.groupId)
      : groups;

    if (!targetGroups.length) {
      throw new Error(`No matching groups found${job.data.groupId ? ` for id: ${job.data.groupId}` : ""}`);
    }

    let totalPostsFound = 0;
    let totalPostsNew = 0;

    for (const group of targetGroups) {
      const maxPosts = job.data.maxPosts ?? group.maxPosts;
      const scrolls = Math.ceil(maxPosts / 5);
      const startTime = Date.now();

      const posts = await scrapeGroup(profileDir, group, scrolls, scrollDelay);
      const postsNew = await savePosts(posts, group.id);
      const durationMs = Date.now() - startTime;

      const metrics: ScrapeMetrics = {
        groupId: group.id,
        postsFound: posts.length,
        postsNew,
        durationMs,
      };

      await saveScrapeLog(metrics);

      totalPostsFound += posts.length;
      totalPostsNew += postsNew;
    }

    if (totalPostsNew > 0) {
      await aiQueue.add("process-pending", {});
    }

    return {
      postsFound: totalPostsFound,
      postsNew: totalPostsNew,
    };
  },
  {
    connection,
    concurrency: 1,
    prefix: bullPrefix,
  },
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completado:`, job.returnvalue);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} falló:`, err.message);
});

console.log("🔄 Scraper Worker iniciado — esperando trabajos...");
