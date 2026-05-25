import { z } from "zod/v4";

export const CategoryEnum = z.enum([
  "casa", "cocina", "aseo", "electronica",
  "ropa", "vehiculos", "muebles", "otros",
]);

export const ListingStatusEnum = z.enum(["active", "sold", "expired"]);

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
  sort: z.enum(["newest", "oldest", "price_asc", "price_desc"]).default("newest"),
});

export type ListingQuery = z.infer<typeof ListingQuerySchema>;
