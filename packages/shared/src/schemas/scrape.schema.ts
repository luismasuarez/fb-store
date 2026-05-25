import { z } from "zod/v4";

export const ScrapeTriggerSchema = z.object({
  groupId: z.string().optional(),
  maxPosts: z.number().int().min(1).max(100).optional(),
});

export type ScrapeTrigger = z.infer<typeof ScrapeTriggerSchema>;
