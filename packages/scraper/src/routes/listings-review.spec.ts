import { describe, it, expect, vi, beforeEach } from "vitest"
import { AppError } from "../lib/app-error"

const mockFindMany = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()

vi.mock("../db", () => ({
  getPrismaClient: () => ({
    listing: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  }),
}))

describe("Listings review API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET /listings/review returns review-queued listings ordered by scrapedAt ASC", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "1", status: "review", scrapedAt: new Date("2026-01-01") },
      { id: "2", status: "review", scrapedAt: new Date("2026-01-02") },
    ])

    const { default: listingsRoute } = await import("./listings")
    const c = {
      json: vi.fn(),
    } as any

    const reviewHandler = listingsRoute.routes.find(
      (r: any) => r.method === "GET" && r.path === "/listings/review",
    )?.handler

    await reviewHandler(c)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "review" },
        orderBy: { scrapedAt: "asc" },
      }),
    )
  })

  it("POST /listings/:id/approve changes status to active", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "1", status: "active" })

    const { default: listingsRoute } = await import("./listings")
    const c = {
      req: { param: vi.fn().mockReturnValue("1") },
      json: vi.fn(),
    } as any

    const approveHandler = listingsRoute.routes.find(
      (r: any) => r.method === "POST" && r.path === "/listings/:id/approve",
    )?.handler

    await approveHandler(c)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "1" },
        data: { status: "active" },
      }),
    )
  })

  it("POST /listings/:id/reject changes status to rejected", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "1", status: "rejected" })

    const { default: listingsRoute } = await import("./listings")
    const c = {
      req: { param: vi.fn().mockReturnValue("1") },
      json: vi.fn(),
    } as any

    const rejectHandler = listingsRoute.routes.find(
      (r: any) => r.method === "POST" && r.path === "/listings/:id/reject",
    )?.handler

    await rejectHandler(c)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "1" },
        data: { status: "rejected" },
      }),
    )
  })

  it("POST /listings/:id/restore changes status from rejected to review", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "1", status: "review" })

    const { default: listingsRoute } = await import("./listings")
    const c = {
      req: { param: vi.fn().mockReturnValue("1") },
      json: vi.fn(),
    } as any

    const restoreHandler = listingsRoute.routes.find(
      (r: any) => r.method === "POST" && r.path === "/listings/:id/restore",
    )?.handler

    await restoreHandler(c)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "1" },
        data: { status: "review" },
      }),
    )
  })

  it("returns 404 for approve on non-existent listing", async () => {
    mockUpdate.mockRejectedValueOnce({ code: "P2025", message: "Record to update not found" })

    const { default: listingsRoute } = await import("./listings")
    const c = {
      req: { param: vi.fn().mockReturnValue("nonexistent") },
      get: vi.fn().mockReturnValue("req-1"),
    } as any

    await expect(listingsRoute.routes.find(
      (r: any) => r.method === "POST" && r.path === "/listings/:id/approve",
    )?.handler(c)).rejects.toThrow(AppError)
  })
})
