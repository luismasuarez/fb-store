import { Controller, Get, Param, Query } from "@nestjs/common";
import { ListingsService } from "../application/listings.service";

@Controller("api/listings")
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  async findAll(@Query() query: any) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Math.min(Number(query.limit), 100) : 20;

    return this.listingsService.findAll({
      page,
      limit,
      listingType: query.listing_type,
      propertyType: query.property_type,
      province: query.province,
      municipality: query.municipality,
      neighborhood: query.neighborhood,
      bedrooms: query.bedrooms ? Number(query.bedrooms) : undefined,
      bathrooms: query.bathrooms ? Number(query.bathrooms) : undefined,
      minPrice: query.min_price ? Number(query.min_price) : undefined,
      maxPrice: query.max_price ? Number(query.max_price) : undefined,
      currency: query.currency,
      status: query.status,
      search: query.search,
      sort: query.sort,
    });
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.listingsService.findOne(id);
  }
}
