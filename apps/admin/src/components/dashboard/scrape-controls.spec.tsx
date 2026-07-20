import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScrapeControls } from "./scrape-controls";
import { fetchGroups } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  fetchGroups: vi.fn(),
  triggerScrape: vi.fn(),
  triggerAiProcess: vi.fn(),
}));

vi.mock("../../hooks/use-scrape", () => ({
  useScrape: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    sse: {
      status: "idle" as const,
      phase: "",
      current: 0,
      total: 0,
      logs: [],
      metrics: null,
      error: null,
      jobId: null,
    },
  }),
  useAiProcess: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({
    data: {
      data: [
        { id: "1", name: "Grupo A", url: null, maxPosts: 10, isActive: true, lastScraped: null, lastError: null, createdAt: "" },
        { id: "2", name: "Grupo B", url: null, maxPosts: 20, isActive: true, lastScraped: null, lastError: null, createdAt: "" },
      ],
    },
    isLoading: false,
  })),
}));

describe("ScrapeControls", () => {
  it("renders select dropdown with active groups", () => {
    render(<ScrapeControls />);

    const select = screen.getByRole("combobox");
    expect(select).toBeDefined();

    expect(screen.getByText("Todos los grupos")).toBeDefined();
    expect(screen.getByText("Grupo A")).toBeDefined();
    expect(screen.getByText("Grupo B")).toBeDefined();
  });
});
