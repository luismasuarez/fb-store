import { z } from "zod/v4";

export const AuthResponseDto = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().positive(),
});
export type AuthResponseDto = z.infer<typeof AuthResponseDto>;
