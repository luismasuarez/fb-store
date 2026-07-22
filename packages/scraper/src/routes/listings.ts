import { Hono } from "hono"
import type { Context } from "hono"
import { getPrismaClient } from "../db"
import { AppError } from "../lib/app-error"
import { toAppError } from "../lib/prisma-errors"

const listingsRoute = new Hono()

listingsRoute.get("/listings", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  const {
    page = "1",
    limit = "20",
    listing_type, property_type,
    province, municipality,
    min_price, max_price,
    currency, status, status_ne, search, sort,
  } = c.req.query()

  const pageNum = Math.max(1, Number(page) || 1)
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20))
  const skip = (pageNum - 1) * limitNum

  const where: any = {}

  if (listing_type) where.listingType = listing_type
  if (property_type) where.propertyType = property_type
  if (province) where.province = province
  if (municipality) where.municipality = municipality
  if (currency) where.currency = currency
  if (status) {
    const statuses = status.split(",").map((s: string) => s.trim()).filter(Boolean)
    if (statuses.length === 1) {
      where.status = statuses[0]
    } else if (statuses.length > 1) {
      where.status = { in: statuses }
    }
  } else {
    where.status = "active"
  }
  if (status_ne) {
    where.NOT = { status: status_ne }
  }
  if (min_price || max_price) {
    where.price = {}
    if (min_price) where.price.gte = Number(min_price)
    if (max_price) where.price.lte = Number(max_price)
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { summaryShort: { contains: search, mode: "insensitive" } },
    ]
  }

  let orderBy: any = { scrapedAt: "desc" }
  if (sort === "price_asc") orderBy = { price: "asc" }
  else if (sort === "price_desc") orderBy = { price: "desc" }
  else if (sort === "oldest") orderBy = { scrapedAt: "asc" }

  const [listings, total] = await Promise.all([
    db.listing.findMany({ where, orderBy, skip, take: limitNum }),
    db.listing.count({ where }),
  ])

  return c.json({
    data: listings,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  })
})

listingsRoute.get("/listings/review", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  const listings = await db.listing.findMany({
    where: { status: "review" },
    orderBy: { scrapedAt: "asc" },
  })
  return c.json({
    data: listings,
    total: listings.length,
    pendingReview: listings.length,
  })
})

listingsRoute.post("/listings/:id/approve", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  try {
    const listing = await db.listing.update({
      where: { id: c.req.param("id") },
      data: { status: "active" },
    })
    return c.json({ data: listing })
  } catch (err) {
    throw toAppError(err)
  }
})

listingsRoute.post("/listings/:id/reject", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  try {
    const listing = await db.listing.update({
      where: { id: c.req.param("id") },
      data: { status: "rejected" },
    })
    return c.json({ data: listing })
  } catch (err) {
    throw toAppError(err)
  }
})

listingsRoute.post("/listings/:id/restore", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  try {
    const listing = await db.listing.update({
      where: { id: c.req.param("id") },
      data: { status: "review" },
    })
    return c.json({ data: listing })
  } catch (err) {
    throw toAppError(err)
  }
})

listingsRoute.get("/listings/:id", async (c: Context<{ Variables: { requestId: string } }>) => {
  const db = getPrismaClient()
  const listing = await db.listing.findUnique({
    where: { id: c.req.param("id") },
    include: { rawPosts: true },
  })
  if (!listing) throw new AppError("not_found", "Listing not found", 404)
  return c.json({ data: listing })
})

export default listingsRoute
