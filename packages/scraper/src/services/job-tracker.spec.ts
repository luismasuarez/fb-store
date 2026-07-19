import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createJob,
  getJob,
  updateJob,
  registerSSE,
  notifyClients,
  removeSSE,
  startCleanup,
  stopCleanup,
} from "./job-tracker";

describe("job-tracker SSE", () => {
  beforeEach(() => {});

  it("T028: registers and notifies SSE clients", async () => {
    const jobId = crypto.randomUUID();
    createJob(jobId, { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" });

    const client = {
      send: vi.fn(),
      close: vi.fn(),
    };

    registerSSE(jobId, client);
    const job = getJob(jobId);
    expect(job?.sseClients.has(client)).toBe(true);

    const progressData = { phase: "scrolling", current: 1, total: 4 };
    await notifyClients(jobId, { type: "progress", data: progressData });

    expect(client.send).toHaveBeenCalledWith("progress", JSON.stringify(progressData));

    removeSSE(jobId, client);
    expect(job?.sseClients.has(client)).toBe(false);
  });
});

describe("job-tracker TTL", () => {
  const TTL_MS = 30 * 60 * 1000;
  const CLEANUP_INTERVAL_MS = 60 * 1000;

  afterEach(() => {
    stopCleanup();
    vi.useRealTimers();
  });

  it("T037: removes completed jobs after TTL", () => {
    vi.useFakeTimers();

    const jobId = crypto.randomUUID();
    createJob(jobId, { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" });

    vi.advanceTimersByTime(TTL_MS + 1000);
    updateJob(jobId, { status: "completed" });

    startCleanup();
    vi.advanceTimersByTime(CLEANUP_INTERVAL_MS);

    expect(getJob(jobId)).toBeUndefined();
  });

  it("T038: does NOT remove running jobs after TTL", () => {
    vi.useFakeTimers();

    const jobId = crypto.randomUUID();
    createJob(jobId, { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" });
    updateJob(jobId, { status: "running" });

    vi.advanceTimersByTime(TTL_MS + 1000);
    startCleanup();
    vi.advanceTimersByTime(CLEANUP_INTERVAL_MS);

    expect(getJob(jobId)).toBeDefined();
  });

  it("T039: cleanup interval runs correctly", () => {
    vi.useFakeTimers();

    const jobId = crypto.randomUUID();
    createJob(jobId, { url: "https://facebook.com/groups/123", maxPosts: 20, profile: "cuenta-1" });

    vi.advanceTimersByTime(TTL_MS + 1000);
    updateJob(jobId, { status: "failed" });

    startCleanup();
    expect(getJob(jobId)).toBeDefined();

    vi.advanceTimersByTime(CLEANUP_INTERVAL_MS);
    expect(getJob(jobId)).toBeUndefined();
  });
});
