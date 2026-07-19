import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod/v4";

export function ZodSchemaPipe(schema: ZodSchema): PipeTransform {
  return {
    transform(value: unknown) {
      const result = schema.safeParse(value);
      if (result.success) {
        return result.data;
      }
      throw new BadRequestException({
        message: "Validation failed",
        errors: result.error.issues.map((issue: any) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    },
  };
}
