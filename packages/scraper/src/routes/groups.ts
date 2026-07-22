import { Hono } from "hono"
import type { Context } from "hono"
import { getPrismaClient } from "../db"
import { toAppError } from "../lib/prisma-errors"
import { AppError } from "../lib/app-error"

const groupsRoute = new Hono()

groupsRoute.get("/groups", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  const groups = await db.group.findMany({ orderBy: { createdAt: "desc" } })
  return c.json({ data: groups })
})

groupsRoute.get("/groups/active", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  const groups = await db.group.findMany({ where: { isActive: true } })
  return c.json({ data: groups })
})

groupsRoute.get("/groups/:id", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  const group = await db.group.findUnique({ where: { id: c.req.param("id") } })
  if (!group) throw new AppError("not_found", "Group not found", 404)
  return c.json({ data: group })
})

groupsRoute.post("/groups", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  const body = await c.req.json()
  try {
    const group = await db.group.create({ data: body })
    return c.json({ data: group }, 201)
  } catch (err) {
    throw toAppError(err)
  }
})

groupsRoute.put("/groups/:id", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  const body = await c.req.json()
  try {
    const group = await db.group.update({ where: { id: c.req.param("id") }, data: body })
    return c.json({ data: group })
  } catch (err) {
    throw toAppError(err)
  }
})

groupsRoute.delete("/groups/:id", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  try {
    await db.group.delete({ where: { id: c.req.param("id") } })
    return c.json({ message: "Deleted" })
  } catch (err) {
    throw toAppError(err)
  }
})

export default groupsRoute
