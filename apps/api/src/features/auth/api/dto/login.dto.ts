import { z } from "zod/v4";

export const LoginDto = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8),
});
export type LoginDto = z.infer<typeof LoginDto>;
