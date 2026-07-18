import { Module } from "@nestjs/common";
import { ListingsController } from "./api/listings.controller";
import { ListingsService } from "./application/listings.service";
import { ListingRepository } from "./infrastructure/listing.repository";

@Module({
  controllers: [ListingsController],
  providers: [ListingsService, ListingRepository],
})
export class ListingsModule {}
