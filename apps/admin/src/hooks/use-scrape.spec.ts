import { describe, it, expect, vi, beforeEach } from "vitest";
import { useScrape } from "./use-scrape";
import { triggerScrape } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  triggerScrape: vi.fn(),
  triggerAiProcess: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(({ mutationFn }) => ({
    mutate: vi.fn((args) => mutationFn(args)),
    mutateAsync: vi.fn((args) => mutationFn(args)),
    isPending: false,
    isError: false,
    error: null,
    sse: {
      status: "idle",
      phase: "",
      current: 0,
      total: 0,
      logs: [],
      metrics: null,
      error: null,
      jobId: null,
    },
  })),
}));

describe("useScrape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (triggerScrape as ReturnType<typeof vi.fn>).mockResolvedValue({
      jobId: "job-123",
    });
  });

  it("calls triggerScrape with groupId and maxPosts when provided", async () => {
    const { mutate } = useScrape();
    await mutate({ groupId: "group-1", maxPosts: 10 });
    expect(triggerScrape).toHaveBeenCalledWith("group-1", 10);
  });

  it("calls triggerScrape without args when no groupId provided", async () => {
    const { mutate } = useScrape();
    await mutate();
    expect(triggerScrape).toHaveBeenCalledWith(undefined, undefined);
  });
});
