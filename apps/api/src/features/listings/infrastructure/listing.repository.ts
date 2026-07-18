import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database/prisma/prisma.service";

export interface ListingsQuery {
  page: number;
  limit: number;
  listingType?: string;
  propertyType?: string;
  province?: string;
  municipality?: string;
  neighborhood?: string;
  bedrooms?: number;
  bathrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  status?: string;
  search?: string;
  sort?: string;
}

@Injectable()
export class ListingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListingsQuery) {
    const where: any = {};
    if (query.listingType) where.listingType = query.listingType;
    if (query.propertyType) where.propertyType = query.propertyType;
    if (query.municipality) where.municipality = query.municipality;
    if (query.neighborhood) where.neighborhood = query.neighborhood;
    if (query.bedrooms !== undefined) where.bedrooms = query.bedrooms;
    if (query.bathrooms !== undefined) where.bathrooms = { gte: query.bathrooms };
    if (query.currency) where.currency = query.currency;
    if (query.status) where.status = query.status;
    if (query.province) where.province = query.province;

    const orConditions: any[] = [];
    if (query.search) {
      orConditions.push(
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      );
    }
    if (orConditions.length > 0) where.OR = orConditions;

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) where.price.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
    }

    const orderBy: any = (() => {
      switch (query.sort) {
        case "oldest": return { scrapedAt: "asc" as const };
        case "price_asc": return { price: "asc" as const };
        case "price_desc": return { price: "desc" as const };
        default: return { scrapedAt: "desc" as const };
      }
    })();

    const skip = (query.page - 1) * query.limit;

    const [data, total] = await Promise.all([
      this.prisma.client.listing.findMany({
        where,
        skip,
        take: query.limit,
        orderBy,
      }),
      this.prisma.client.listing.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.client.listing.findUnique({ where: { id } });
  }
}
