import { getPrismaClient } from "@fb-store/shared";
import { scrapeGroup, type ScrapeMetrics } from "../index";
import type { RawPost } from "../extractor";
import { getProfileDir } from "../browser";
import { updateJob, notifyClients } from "./job-tracker";
import type { JobPhase } from "./job-tracker";

interface GroupConfig {
  id: string;
  name: string;
  maxPosts: number;
}

export interface RunScrapeConfig {
  url?: string;
  groupId?: string;
  maxPosts: number;
  profile: string;
}

function extractGroupIdFromUrl(url: string): string | null {
  const match = url.match(/facebook\.com\/groups\/([^/?]+)/);
  return match ? match[1] : null;
}

export async function runScrape(
  jobId: string,
  config: RunScrapeConfig,
): Promise<{ posts: RawPost[]; metrics: ScrapeMetrics }> {
  const profileDir = getProfileDir(config.profile);
  const scrollDelayMs = 4000;
  const startTime = Date.now();

  try {
    let group: GroupConfig;
    if (config.url) {
      const extracted = extractGroupIdFromUrl(config.url);
      if (!extracted) {
        throw new Error("BUSINESS:Could not extract group ID from URL");
      }
      group = { id: extracted, name: extracted, maxPosts: config.maxPosts };
    } else if (config.groupId) {
      const prisma = getPrismaClient();
      const dbGroup = await prisma.group.findUnique({ where: { id: config.groupId } });
      if (!dbGroup) {
        throw new Error("BUSINESS:Group not found");
      }
      group = { id: dbGroup.id, name: dbGroup.name, maxPosts: dbGroup.maxPosts };
    } else {
      throw new Error("BUSINESS:Either url or groupId must be provided");
    }

    const maxScrolls = Math.ceil(group.maxPosts / 5);

    const posts = await scrapeGroup(
      profileDir,
      group,
      maxScrolls,
      scrollDelayMs,
      (phase, current, total) => {
        const jobPhase = phase as JobPhase;
        updateJob(jobId, {
          progress: { phase: jobPhase, current, total },
        });
        notifyClients(jobId, {
          type: "progress",
          data: { phase: jobPhase, current, total },
        });
      },
    );

    const durationMs = Date.now() - startTime;
    const groupId = group.id;
    const postsLen = posts.length;

    const result = {
      posts,
      metrics: {
        groupId,
        postsFound: postsLen,
        postsNew: postsLen,
        durationMs,
      },
    };

    notifyClients(jobId, { type: "complete", data: result });

    return result;
  } catch (err: any) {
    const message = err.message || "Unknown error";
    notifyClients(jobId, { type: "error", data: { message } });
    throw err;
  }
}
