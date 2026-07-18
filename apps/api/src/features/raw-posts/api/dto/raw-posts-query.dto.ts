import { z } from "zod/v4";
import { PaginationSchema } from "../../../../common/dto/pagination.schema";

export const RawPostsQuerySchema = PaginationSchema.extend({
  status: z.enum(["pending", "processed", "skipped"]).optional(),
  group_id: z.string().optional(),
  "scrapedAt[gte]": z.string().optional(),
  "scrapedAt[lte]": z.string().optional(),
});
