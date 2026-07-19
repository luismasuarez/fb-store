import { z } from "zod/v4";

export const CreateGroupDto = z.object({
  id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  url: z.string().url().max(2048),
  maxPosts: z.number().int().min(1).default(30).optional(),
  isActive: z.boolean().default(true).optional(),
});
export type CreateGroupDto = z.infer<typeof CreateGroupDto>;
