import { z } from "zod/v4";

export const RefreshDto = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshDto = z.infer<typeof RefreshDto>;
