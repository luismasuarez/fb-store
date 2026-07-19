import { describe, it, expect, vi, beforeEach } from "vitest";
import { createJob, getJob, registerSSE, notifyClients, removeSSE } from "./job-tracker";

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
