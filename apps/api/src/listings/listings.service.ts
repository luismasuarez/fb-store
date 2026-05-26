import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RealEstateListingQuery } from "@fb-store/shared";

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: RealEstateListingQuery) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.listingType) where.listingType = params.listingType;
    if (params.propertyType) where.propertyType = params.propertyType;
    if (params.municipality) where.municipality = params.municipality;
    if (params.neighborhood) where.neighborhood = params.neighborhood;
    if (params.bedrooms !== undefined) where.bedrooms = Number(params.bedrooms);
    if (params.bathrooms !== undefined) where.bathrooms = { gte: Number(params.bathrooms) };
    if (params.currency) where.currency = params.currency;
    if (params.status) where.status = params.status;

    const orConditions: any[] = [];

    if (params.province) {
      orConditions.push({ province: params.province }, { municipality: params.province });
    }

    if (params.search) {
      orConditions.push(
        { title: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      );
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.price = {};
      if (params.minPrice !== undefined) where.price.gte = Number(params.minPrice);
      if (params.maxPrice !== undefined) where.price.lte = Number(params.maxPrice);
    }

    const orderBy: any = (() => {
      switch (params.sort) {
        case "oldest": return { scrapedAt: "asc" as const };
        case "price_asc": return { price: "asc" as const };
        case "price_desc": return { price: "desc" as const };
        default: return { scrapedAt: "desc" as const };
      }
    })();

    const [data, total] = await Promise.all([
      this.prisma.client.listing.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.client.listing.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    return this.prisma.client.listing.findUnique({
      where: { id },
    });
  }
}
