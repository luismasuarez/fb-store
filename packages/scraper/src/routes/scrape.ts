import { getPrismaClient } from "@fb-store/shared";
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

const scrapeRoute = new Hono();

function classifyError(err: any): { code: string; message: string; status: 400 | 401 | 404 | 409 | 500 | 502 | 503 } {
  const msg = (err?.message || "").toLowerCase();
  let cleanMessage = err?.message?.replace(/^BUSINESS:/, "") || "Unknown error";

  if (
    msg.includes("net::") ||
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("err_connection") ||
    msg.includes("err_name_not_resolved")
  ) {
    return { code: "network_error", message: "Cannot connect to Facebook. Check your internet connection.", status: 502 };
  }

  if (
    msg.includes("login") ||
    msg.includes("session expired") ||
    msg.includes("redirected to login") ||
    msg.includes("not logged in")
  ) {
    return { code: "session_expired", message: "Facebook login session has expired. Please re-login.", status: 401 };
  }

  if (
    msg.includes("prisma") ||
    msg.includes("p1001") ||
    msg.includes("p1002") ||
    msg.includes("can't reach database") ||
    msg === "connect econnrefused"
  ) {
    return { code: "db_error", message: "Database is not available. Try again later or use URL mode.", status: 503 };
  }

  if (err?.message?.startsWith("BUSINESS:")) {
    return { code: "business", message: cleanMessage, status: 400 };
  }

  return { code: "unknown", message: cleanMessage || "An unexpected error occurred", status: 500 };
}

scrapeRoute.post("/scrape", async (c: Context<{ Variables: { requestId: string } }>) => {
  const body = await c.req.json();
  const parsed = ScrapeRequestSchema.parse(body);

  if (parsed.url) {
    const fbMatch = parsed.url.match(/facebook\.com\/groups\/([^/?]+)/);
    if (!fbMatch) {
      return c.json({
        error: { code: "invalid_url", message: "URL must be a valid Facebook group URL (e.g., https://facebook.com/groups/123)", requestId: c.get("requestId") },
      }, 400);
    }
  }

  if (parsed.groupId) {
    try {
      const prisma = getPrismaClient();
      const group = await prisma.group.findUnique({ where: { id: parsed.groupId } });
      if (!group) {
        return c.json({
          error: { code: "not_found", message: "Group not found", requestId: c.get("requestId") },
        }, 404);
      }
    } catch (err: any) {
      const errorInfo = classifyError(err);
      return c.json({
        error: { code: errorInfo.code, message: errorInfo.message, requestId: c.get("requestId") },
      }, errorInfo.status);
    }
  }

  const activeJob = getActiveJobForProfile(parsed.profile);
  if (activeJob) {
    return c.json({
      error: { code: "business", message: "Profile already has an active scrape job", requestId: c.get("requestId") },
    }, 409);
  }

  const jobId = crypto.randomUUID();
  createJob(jobId, {
    url: parsed.url,
    groupId: parsed.groupId,
    maxPosts: parsed.maxPosts,
    profile: parsed.profile,
  });

  if (parsed.wait) {
    try {
      const result = await runScrape(jobId, parsed);
      updateJob(jobId, { status: "completed", result });
      return c.json(result, 200);
    } catch (err: any) {
      const errorInfo = classifyError(err);
      updateJob(jobId, { status: "failed", failedReason: errorInfo.message });
      return c.json({
        error: { code: errorInfo.code, message: errorInfo.message, requestId: c.get("requestId") },
      }, errorInfo.status);
    }
  }

  runScrape(jobId, parsed).then((result) => {
    updateJob(jobId, { status: "completed", result });
  }).catch((err: any) => {
    const errorInfo = classifyError(err);
    updateJob(jobId, { status: "failed", failedReason: errorInfo.message });
  });

  return c.json({ jobId }, 202);
});

scrapeRoute.get("/scrape/:jobId", async (c: Context<{ Variables: { requestId: string } }>) => {
  const jid = c.req.param("jobId") as string;
  const job = getJob(jid);
  if (!job) {
    return c.json({ error: { code: "not_found", message: "Job not found", requestId: c.get("requestId") } }, 404);
  }

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
  if (!job) {
    return c.json({ error: { code: "not_found", message: "Job not found", requestId: c.get("requestId") } }, 404);
  }

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

export default scrapeRoute;
