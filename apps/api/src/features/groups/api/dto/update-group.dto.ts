import { z } from "zod/v4";

export const UpdateGroupDto = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().max(2048).optional(),
  maxPosts: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateGroupDto = z.infer<typeof UpdateGroupDto>;
