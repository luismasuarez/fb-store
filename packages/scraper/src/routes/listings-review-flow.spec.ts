import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

const mockFindMany = vi.fn()
const mockUpdate = vi.fn()
const mockFindUnique = vi.fn()

vi.mock("../db", () => ({
  getPrismaClient: () => ({
    listing: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  }),
}))

import { errorHandler } from "../middleware/error-handler"
import listingsRoute from "./listings"

function createTestApp() {
  const app = new Hono<{ Variables: { requestId: string } }>()
  app.use("*", async (c, next) => {
    c.set("requestId", crypto.randomUUID())
    await next()
  })
  app.onError(errorHandler)
  app.route("/api/v1", listingsRoute)
  return app
}

describe("Full review flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("approves a review listing to active", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "listing-1", status: "active" })

    const app = createTestApp()
    const res = await app.request("/api/v1/listings/listing-1/approve", { method: "POST" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe("active")
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: { status: "active" },
    })
  })

  it("rejects a review listing", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "listing-1", status: "rejected" })

    const app = createTestApp()
    const res = await app.request("/api/v1/listings/listing-1/reject", { method: "POST" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe("rejected")
  })

  it("restores a rejected listing to review", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "listing-1", status: "review" })

    const app = createTestApp()
    const res = await app.request("/api/v1/listings/listing-1/restore", { method: "POST" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe("review")
  })

  it("lists review-queued listings oldest first", async () => {
    const oldDate = new Date("2026-01-01")
    const newDate = new Date("2026-06-01")
    mockFindMany.mockResolvedValueOnce([
      { id: "1", status: "review", scrapedAt: oldDate },
      { id: "2", status: "review", scrapedAt: newDate },
    ])

    const app = createTestApp()
    const res = await app.request("/api/v1/listings/review")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.pendingReview).toBe(2)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "review" },
        orderBy: { scrapedAt: "asc" },
      }),
    )
  })

  it("returns 404 on approve for non-existent listing", async () => {
    mockUpdate.mockRejectedValueOnce({ code: "P2025", message: "Record to update not found" })

    const app = createTestApp()
    const res = await app.request("/api/v1/listings/nonexistent/approve", { method: "POST" })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("not_found")
  })
})
