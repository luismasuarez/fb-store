import { getPrismaClient } from "../db";
import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { ScrapeRequestSchema } from "../schemas";
import {
  createJob, getJob, getActiveJobForProfile, updateJob,
  registerSSE, removeSSE, onJobCompletion, removeJobCompletion,
} from "../services/job-tracker";
import type { SSEClient } from "../services/job-tracker";
import { runScrape } from "../services/scrape-runner";
import { getDefaultProfile } from "../services/profile-manager";
import { AppError } from "../lib/app-error";
import { toAppError } from "../lib/prisma-errors";

const scrapeRoute = new Hono();

scrapeRoute.post("/scrape", async (c: Context<{ Variables: { requestId: string } }>) => {
  const body = await c.req.json();
  const parsed = ScrapeRequestSchema.parse(body);

  const profile = parsed.profile ?? await getDefaultProfile();
  if (!profile) {
    throw new AppError("validation_error", "No profile specified and no default profile available. Create a profile first.", 400);
  }

  if (parsed.url) {
    const fbMatch = parsed.url.match(/facebook\.com\/groups\/([^/?]+)/);
    if (!fbMatch) {
      throw new AppError("validation_error", "URL must be a valid Facebook group URL (e.g., https://facebook.com/groups/123)", 400)
    }
  }

  if (parsed.groupId) {
    const prisma = getPrismaClient();
    const group = await prisma.group.findUnique({ where: { id: parsed.groupId } });
    if (!group) throw new AppError("not_found", "Group not found", 404)
  }

  const activeJob = getActiveJobForProfile(profile);
  if (activeJob) {
    return c.json({
      jobId: activeJob.id,
      status: activeJob.status,
      alreadyRunning: true,
      message: "Profile already has an active scrape job",
    }, 200);
  }

  const jobId = crypto.randomUUID();
  createJob(jobId, {
    url: parsed.url,
    groupId: parsed.groupId,
    maxPosts: parsed.maxPosts,
    profile,
  });

  const scrapeConfig = { ...parsed, profile };

  if (parsed.wait) {
    try {
      const result = await runScrape(jobId, scrapeConfig);
      updateJob(jobId, { status: "completed", result });
      return c.json(result, 200);
    } catch (err) {
      const appErr = err instanceof AppError ? err : toAppError(err);
      updateJob(jobId, { status: "failed", failedReason: appErr.message });
      throw appErr
    }
  }

  runScrape(jobId, scrapeConfig).then((result) => {
    updateJob(jobId, { status: "completed", result });
  }).catch((err: any) => {
    const appErr = err instanceof AppError ? err : toAppError(err);
    updateJob(jobId, { status: "failed", failedReason: appErr.message });
  });

  return c.json({ jobId }, 202);
});

scrapeRoute.get("/scrape/:jobId", async (c: Context<{ Variables: { requestId: string } }>) => {
  const jid = c.req.param("jobId") as string;
  const job = getJob(jid);
  if (!job) throw new AppError("not_found", "Job not found", 404)

  return c.json({
    id: job.id,
    status: job.status,
    config: job.config,
    progress: job.progress,
    result: job.result,
    createdAt: job.createdAt,
  });
});

scrapeRoute.get("/scrape/:jobId/events", (c: Context<{ Variables: { requestId: string } }>) => {
  const jid = c.req.param("jobId") as string;
  const job = getJob(jid);
  if (!job) throw new AppError("not_found", "Job not found", 404)

  return streamSSE(c, async (stream) => {
    if (job.status === "completed") {
      await stream.writeSSE({
        event: "complete",
        data: JSON.stringify({ posts: job.result?.posts, metrics: job.result?.metrics }),
      });
      return;
    }

    if (job.status === "failed") {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: job.failedReason }),
      });
      return;
    }

    const client: SSEClient = {
      send: (event, data) => {
        return stream.writeSSE({ event, data });
      },
      close: () => {
        stream.close();
      },
    };

    registerSSE(jid, client);

    const cleanup = () => {
      removeSSE(jid, client);
      removeJobCompletion(jid);
    };

    stream.onAbort(() => cleanup());
    c.req.raw.signal.addEventListener("abort", () => cleanup());

    return new Promise<void>((resolve) => {
      onJobCompletion(jid, () => {
        cleanup();
        resolve();
      });
    });
  });
});

scrapeRoute.get("/scrape/active/:profile", async (c: Context<{ Variables: { requestId: string } }>) => {
  const profile = c.req.param("profile") as string;
  const job = getActiveJobForProfile(profile);
  if (!job) {
    return c.json({ active: false }, 200);
  }

  return c.json({
    active: true,
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
  });
});

scrapeRoute.get("/scrape-logs", async (c: Context<{ Variables: { requestId: string } }>) => {
  const prisma = getPrismaClient();
  const logs = await prisma.scrapeLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return c.json({ data: logs });
});

export default scrapeRoute;
