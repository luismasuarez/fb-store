import { PaginationSchema } from "../../../../common/dto/pagination.schema";

export const ListingsQuerySchema = PaginationSchema.extend({
  listing_type: PaginationSchema.shape.listing_type?.optional(),
  property_type: PaginationSchema.shape.property_type?.optional(),
  province: PaginationSchema.shape.province?.optional(),
  municipality: PaginationSchema.shape.municipality?.optional(),
  neighborhood: PaginationSchema.shape.neighborhood?.optional(),
  bedrooms: PaginationSchema.shape.bedrooms?.optional(),
  bathrooms: PaginationSchema.shape.bathrooms?.optional(),
  min_price: PaginationSchema.shape.min_price?.optional(),
  max_price: PaginationSchema.shape.max_price?.optional(),
  currency: PaginationSchema.shape.currency?.optional(),
  status: PaginationSchema.shape.status?.optional(),
  search: PaginationSchema.shape.search?.optional(),
  sort: PaginationSchema.shape.sort?.optional(),
}).optional();
