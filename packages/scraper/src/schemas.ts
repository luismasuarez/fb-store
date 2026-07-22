import { z } from "zod";

export const ScrapeRequestSchema = z.object({
  url: z.string().url().optional(),
  groupId: z.string().optional(),
  maxPosts: z.number().int().positive().default(20),
  profile: z.string().optional(),
  wait: z.boolean().default(false),
}).refine(
  (data) => (data.url !== undefined) !== (data.groupId !== undefined),
  { message: "Provide either url or groupId, not both" },
);

export const CreateProfileRequestSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  isDefault: z.boolean().optional(),
});

export const LoginRequestSchema = z.object({
  profile: z.string(),
});

export type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;
export type CreateProfileRequest = z.infer<typeof CreateProfileRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
