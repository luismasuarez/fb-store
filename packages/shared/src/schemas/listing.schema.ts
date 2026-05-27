import { z } from "zod/v4";

export const CategoryEnum = z.enum([
  "casa", "cocina", "aseo", "electronica",
  "ropa", "vehiculos", "muebles", "otros",
]);

export const ListingStatusEnum = z.enum(["active", "sold", "expired"]);

export const ListingTypeEnum = z.enum(["sale", "rent", "swap", "unknown"]);

export const PropertyTypeEnum = z.enum(["apartment", "house", "room", "land", "commercial"]);

export const SortEnum = z.enum(["newest", "oldest", "price_asc", "price_desc"]);

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListingQuerySchema = PaginationSchema.extend({
  category: CategoryEnum.optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  status: ListingStatusEnum.default("active"),
  groupId: z.string().optional(),
  sort: SortEnum.default("newest"),
});

export const RealEstateListingQuerySchema = PaginationSchema.extend({
  listing_type: ListingTypeEnum.optional(),
  property_type: PropertyTypeEnum.optional(),
  province: z.string().optional(),
  municipality: z.string().optional(),
  neighborhood: z.string().optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  currency: z.string().optional(),
  status: ListingStatusEnum.default("active"),
  search: z.string().optional(),
  sort: SortEnum.default("newest"),
});

export type ListingQuery = z.infer<typeof ListingQuerySchema>;
export type RealEstateListingQuery = z.infer<typeof RealEstateListingQuerySchema>;
