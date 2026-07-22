import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("../db", () => ({
  getPrismaClient: vi.fn(),
}));
vi.mock("../services/job-tracker");
vi.mock("../services/scrape-runner");
vi.mock("../services/profile-manager", () => ({
  getDefaultProfile: vi.fn().mockResolvedValue("cuenta-1"),
}));

import { getPrismaClient } from "../db";
import { createJob, getJob, getActiveJobForProfile, updateJob, registerSSE, notifyClients, removeSSE, onJobCompletion, removeJobCompletion } from "../services/job-tracker";
import { runScrape } from "../services/scrape-runner";
import { errorHandler } from "../middleware/error-handler";
import scrapeRoute from "./scrape";

const mockPost = {
  fbPostId: "fb-123",
  text: "Test post with enough text to pass validation filters",
  images: [],
  author: "Test User",
  authorUrl: "/user/test",
  timestamp: "2024-01-01T00:00:00Z",
  postUrl: "/groups/123/posts/456",
};

function createTestApp() {
  const app = new Hono<{ Variables: { requestId: string } }>();
  app.use("*", async (c, next) => {
    c.set("requestId", crypto.randomUUID());
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/v1", scrapeRoute);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/v1/scrape", () => {
  it("T010: returns 202 with valid URL", async () => {
    const app = createTestApp();
    vi.mocked(getActiveJobForProfile).mockReturnValue(undefined);
    vi.mocked(createJob).mockReturnValue({
      id: "job-1",
      status: "pending",
      config: { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" },
      progress: { phase: "queued", current: 0, total: 0 },
      createdAt: new Date(),
      sseClients: new Set(),
    });
    vi.mocked(runScrape).mockResolvedValue({ posts: [], metrics: {} as any });

    const res = await app.request("/api/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://facebook.com/groups/123" }),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toHaveProperty("jobId");
  });

  it("T011: returns 202 with groupId", async () => {
    const app = createTestApp();
    const mockPrisma = {
      group: { findUnique: vi.fn().mockResolvedValue({ id: "group-456", name: "Test Group", maxPosts: 30 }) },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma as any);
    vi.mocked(getActiveJobForProfile).mockReturnValue(undefined);
    vi.mocked(createJob).mockReturnValue({
      id: "job-2",
      status: "pending",
      config: { groupId: "group-456", maxPosts: 20, profile: "cuenta-1" },
      progress: { phase: "queued", current: 0, total: 0 },
      createdAt: new Date(),
      sseClients: new Set(),
    });
    vi.mocked(runScrape).mockResolvedValue({ posts: [], metrics: {} as any });

    const res = await app.request("/api/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: "group-456" }),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toHaveProperty("jobId");
    expect(mockPrisma.group.findUnique).toHaveBeenCalledWith({ where: { id: "group-456" } });
  });

  it("T070: returns 404 when groupId does not exist in DB", async () => {
    const app = createTestApp();
    const mockPrisma = {
      group: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma as any);

    const res = await app.request("/api/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: "nonexistent" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("T012: returns 400 with missing url/groupId", async () => {
    const app = createTestApp();

    const res = await app.request("/api/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("T013: returns 200 with posts when wait=true", async () => {
    const app = createTestApp();
    vi.mocked(getActiveJobForProfile).mockReturnValue(undefined);
    vi.mocked(createJob).mockReturnValue({
      id: "job-3",
      status: "pending",
      config: { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" },
      progress: { phase: "queued", current: 0, total: 0 },
      createdAt: new Date(),
      sseClients: new Set(),
    });
    vi.mocked(runScrape).mockResolvedValue({
      posts: [mockPost],
      metrics: { groupId: "123", postsFound: 1, postsNew: 0, durationMs: 5000 },
    });

    const res = await app.request("/api/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://facebook.com/groups/123", wait: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("posts");
    expect(body.posts).toHaveLength(1);
    expect(body).toHaveProperty("metrics");
  });

  it("T016: returns 409 when profile is already scraping", async () => {
    const app = createTestApp();
    vi.mocked(getActiveJobForProfile).mockReturnValue({
      id: "existing-job",
      status: "running",
      config: { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" },
      progress: { phase: "scrolling", current: 2, total: 4 },
      createdAt: new Date(),
      sseClients: new Set(),
    });

    const res = await app.request("/api/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://facebook.com/groups/789" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyRunning).toBe(true);
  });
});

describe("GET /api/v1/scrape/:jobId", () => {
  it("T014: returns job state for existing job", async () => {
    const app = createTestApp();
    const jobState = {
      id: "job-1",
      status: "running",
      config: { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" },
      progress: { phase: "scrolling" as const, current: 2, total: 4 },
      createdAt: new Date(),
      sseClients: new Set(),
    };
    vi.mocked(getJob).mockReturnValue(jobState);

    const res = await app.request("/api/v1/scrape/job-1");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("job-1");
    expect(body.status).toBe("running");
    expect(body.config.url).toBe("https://facebook.com/groups/123");
    expect(body.progress.phase).toBe("scrolling");
  });

  it("T015: returns 404 for unknown job", async () => {
    const app = createTestApp();
    vi.mocked(getJob).mockReturnValue(undefined);

    const res = await app.request("/api/v1/scrape/unknown-job");

    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/scrape/:jobId/events", () => {
  let sseClients: Set<any>;
  let jobCompletions: Map<string, () => void>;

  function setupSSEMocks() {
    sseClients = new Set();
    jobCompletions = new Map();

    vi.mocked(registerSSE).mockImplementation((_jobId: string, client: any) => {
      sseClients.add(client);
    });

    vi.mocked(notifyClients).mockImplementation(async (_jobId: string, event: any) => {
      const data = JSON.stringify(event.data);
      const promises: Promise<void>[] = [];
      for (const client of sseClients) {
        const result = client.send(event.type, data);
        if (result && typeof result.then === "function") {
          promises.push(result);
        }
      }
      await Promise.all(promises);
      if ((event.type === "complete" || event.type === "error") && sseClients.size > 0) {
        const cb = jobCompletions.get(_jobId);
        if (cb) {
          jobCompletions.delete(_jobId);
          cb();
        }
      }
    });

    vi.mocked(removeSSE).mockImplementation((_jobId: string, client: any) => {
      sseClients.delete(client);
    });

    vi.mocked(onJobCompletion).mockImplementation((_jobId: string, cb: () => void) => {
      jobCompletions.set(_jobId, cb);
    });

    vi.mocked(removeJobCompletion).mockImplementation((_jobId: string) => {
      jobCompletions.delete(_jobId);
    });
  }

  function parseSSE(text: string): { event?: string; data?: string }[] {
    return text.split("\n\n").filter(Boolean).map((block) => {
      const ev: { event?: string; data?: string } = {};
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) ev.event = line.slice(7);
        else if (line.startsWith("data: ")) ev.data = line.slice(6);
      }
      return ev;
    });
  }

  it("T024: returns SSE content-type", async () => {
    const app = createTestApp();
    setupSSEMocks();
    vi.mocked(getJob).mockReturnValue({
      id: "job-sse-1",
      status: "running",
      config: { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" },
      progress: { phase: "scrolling", current: 2, total: 4 },
      createdAt: new Date(),
      sseClients: new Set(),
    });

    const res = await app.request("/api/v1/scrape/job-sse-1/events");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/event-stream/);

    const cb = jobCompletions.get("job-sse-1");
    if (cb) cb();
  });

  async function collectStream(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder): Promise<string> {
    let allData = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      allData += decoder.decode(value, { stream: true });
    }
    return allData;
  }

  it("T025: receives progress events", async () => {
    const app = createTestApp();
    setupSSEMocks();
    vi.mocked(getJob).mockReturnValue({
      id: "job-sse-2",
      status: "running",
      config: { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" },
      progress: { phase: "queued", current: 0, total: 0 },
      createdAt: new Date(),
      sseClients: new Set(),
    });

    const res = await app.request("/api/v1/scrape/job-sse-2/events");
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    const readPromise = collectStream(reader, decoder);

    await notifyClients("job-sse-2", { type: "progress", data: { phase: "navigating", current: 0, total: 0 } });
    await notifyClients("job-sse-2", { type: "progress", data: { phase: "scrolling", current: 1, total: 4 } });
    await notifyClients("job-sse-2", { type: "complete", data: { posts: [], metrics: {} } });

    const allData = await readPromise;
    const events = parseSSE(allData);
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events[0].event).toBe("progress");
    expect(events[1].event).toBe("progress");
    expect(events[2].event).toBe("complete");
  });

  it("T026: receives complete event with posts", async () => {
    const app = createTestApp();
    setupSSEMocks();
    vi.mocked(getJob).mockReturnValue({
      id: "job-sse-3",
      status: "running",
      config: { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" },
      progress: { phase: "extracting", current: 5, total: 10 },
      createdAt: new Date(),
      sseClients: new Set(),
    });

    const res = await app.request("/api/v1/scrape/job-sse-3/events");
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    const readPromise = collectStream(reader, decoder);

    const posts = [mockPost];
    await notifyClients("job-sse-3", { type: "complete", data: { posts, metrics: { groupId: "123", postsFound: 1, postsNew: 0, durationMs: 5000 } } });

    const allData = await readPromise;
    const events = parseSSE(allData);
    const completeEvent = events.find((e) => e.event === "complete");
    expect(completeEvent).toBeDefined();
    const parsed = JSON.parse(completeEvent!.data!);
    expect(parsed.posts).toHaveLength(1);
    expect(parsed.posts[0].fbPostId).toBe("fb-123");
    expect(parsed.metrics.postsFound).toBe(1);
  });

  it("T027: receives error event on failure", async () => {
    const app = createTestApp();
    setupSSEMocks();
    vi.mocked(getJob).mockReturnValue({
      id: "job-sse-4",
      status: "running",
      config: { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" },
      progress: { phase: "navigating", current: 0, total: 0 },
      createdAt: new Date(),
      sseClients: new Set(),
    });

    const res = await app.request("/api/v1/scrape/job-sse-4/events");
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    const readPromise = collectStream(reader, decoder);

    await notifyClients("job-sse-4", { type: "error", data: { message: "Session expired" } });

    const allData = await readPromise;
    const events = parseSSE(allData);
    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    const parsed = JSON.parse(errorEvent!.data!);
    expect(parsed.message).toBe("Session expired");
  });
});
