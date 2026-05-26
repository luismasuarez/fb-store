import { Controller, Get, Param, Query } from "@nestjs/common";
import { ZodValidationPipe } from "@anatine/zod-nestjs";
import { z } from "zod/v4";
import { RealEstateListingQuerySchema } from "@fb-store/shared";
import type { RealEstateListingQuery } from "@fb-store/shared";
import { ListingsService } from "./listings.service";

const UuidSchema = z.string().uuid();

@Controller("api/listings")
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(RealEstateListingQuerySchema)) query: RealEstateListingQuery,
  ) {
    return this.listingsService.findAll(query);
  }

  @Get(":id")
  async findOne(
    @Param("id", new ZodValidationPipe(UuidSchema)) id: string,
  ) {
    return this.listingsService.findOne(id);
  }
}
