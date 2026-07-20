import { Hono } from "hono";
import type { Context } from "hono";
import { getPrismaClient } from "../db";
import { runScrape } from "../services/scrape-runner";

interface ScheduleConfig {
  intervalMinutes: number;
  enabled: boolean;
}

let config: ScheduleConfig = { intervalMinutes: 240, enabled: true };
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function executeCycle(): Promise<void> {
  if (running || !config.enabled) return;
  running = true;
  try {
    const db = getPrismaClient();
    const groups = await db.group.findMany({ where: { isActive: true } });
    for (const group of groups) {
      try {
        await runScrape(crypto.randomUUID(), {
          groupId: group.id,
          maxPosts: group.maxPosts,
          profile: "cuenta-1",
        });
      } catch (err) {
        console.error(`[Scheduler] Error on group ${group.id}:`, (err as Error).message);
      }
    }
  } finally {
    running = false;
  }
}

function start(): void {
  if (timer || !config.enabled) return;
  timer = setInterval(executeCycle, config.intervalMinutes * 60 * 1000);
}

function stop(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

const scheduleRoute = new Hono();

scheduleRoute.get("/schedule", (c: Context<{ Variables: { requestId: string } }>) => {
  return c.json({ data: { ...config } });
});

scheduleRoute.put("/schedule", async (c: Context<{ Variables: { requestId: string } }>) => {
  const body = await c.req.json();
  if (body.intervalMinutes !== undefined) {
    if (body.intervalMinutes < 30) {
      return c.json({ error: { code: "validation", message: "intervalMinutes must be >= 30", requestId: c.get("requestId") } }, 400);
    }
    config.intervalMinutes = body.intervalMinutes;
  }
  if (body.enabled !== undefined) {
    config.enabled = body.enabled;
  }
  stop();
  start();
  return c.json({ data: { ...config } });
});

export { start as startScheduler, stop as stopScheduler };
export default scheduleRoute;
