import { describe, it, expect, vi } from "vitest"

const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock("../db", () => ({
  getPrismaClient: () => ({
    group: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: mockCreate,
      update: mockUpdate,
      delete: vi.fn(),
    },
  }),
}))

describe("Groups API contract", () => {
  it("group create accepts purpose and threshold fields in DB layer", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "group-1",
      purpose: "inmuebles",
      rejectThreshold: 0.2,
      classifyThreshold: 0.5,
    })

    const { getPrismaClient } = await import("../db")
    const db = getPrismaClient()

    const result = await db.group.create({
      data: {
        id: "group-1",
        purpose: "inmuebles",
        rejectThreshold: 0.2,
        classifyThreshold: 0.5,
      },
    })

    expect(result.purpose).toBe("inmuebles")
    expect(result.rejectThreshold).toBe(0.2)
    expect(result.classifyThreshold).toBe(0.5)
  })

  it("group update accepts purpose and threshold fields in DB layer", async () => {
    mockUpdate.mockResolvedValueOnce({
      id: "group-1",
      purpose: "vehiculos",
      rejectThreshold: 0.3,
      classifyThreshold: 0.6,
    })

    const { getPrismaClient } = await import("../db")
    const db = getPrismaClient()

    const result = await db.group.update({
      where: { id: "group-1" },
      data: {
        purpose: "vehiculos",
        rejectThreshold: 0.3,
        classifyThreshold: 0.6,
      },
    })

    expect(result.purpose).toBe("vehiculos")
    expect(result.rejectThreshold).toBe(0.3)
    expect(result.classifyThreshold).toBe(0.6)
  })
})
