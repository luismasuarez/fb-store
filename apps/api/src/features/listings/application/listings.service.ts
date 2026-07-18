import { Injectable, NotFoundException } from "@nestjs/common";
import { ListingRepository } from "../infrastructure/listing.repository";
import type { ListingsQuery } from "../infrastructure/listing.repository";
import { wrapSuccessList, wrapSuccessItem } from "../../../common/dto/api-response";

@Injectable()
export class ListingsService {
  constructor(private readonly listingRepository: ListingRepository) {}

  async findAll(params: ListingsQuery) {
    const { data, total } = await this.listingRepository.findAll(params);
    return wrapSuccessList(data, {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    });
  }

  async findOne(id: string) {
    const listing = await this.listingRepository.findById(id);
    if (!listing) {
      throw new NotFoundException(`Listing ${id} not found`);
    }
    return wrapSuccessItem(listing);
  }
}
