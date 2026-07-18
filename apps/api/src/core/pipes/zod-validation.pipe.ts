import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from "@nestjs/common";
import type { ZodSchema } from "zod/v4";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema = metadata.metatype as ZodSchema;
    if (!schema || !schema.safeParse) {
      return value;
    }

    const result = schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    throw new BadRequestException({
      message: "Validation failed",
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
}
