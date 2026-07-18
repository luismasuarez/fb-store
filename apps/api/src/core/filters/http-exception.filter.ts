import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

interface ErrorCategory {
  statusCode: number;
  category: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();

    const { statusCode, category } = this.categorize(exception);
    const message = this.safeMessage(exception);

    const responseBody = {
      error: {
        code: category,
        message,
        requestId: (request as any).id || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, statusCode);
  }

  private categorize(exception: unknown): ErrorCategory {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      switch (status) {
        case HttpStatus.BAD_REQUEST:
          return { statusCode: status, category: "validation" };
        case HttpStatus.UNAUTHORIZED:
          return { statusCode: status, category: "authorization" };
        case HttpStatus.FORBIDDEN:
          return { statusCode: status, category: "authorization" };
        case HttpStatus.NOT_FOUND:
          return { statusCode: status, category: "business" };
        case HttpStatus.CONFLICT:
          return { statusCode: status, category: "business" };
        case HttpStatus.UNPROCESSABLE_ENTITY:
          return { statusCode: status, category: "business" };
        case HttpStatus.TOO_MANY_REQUESTS:
          return { statusCode: status, category: "rate_limit" };
        default:
          return { statusCode: status, category: "unknown" };
      }
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, category: "unknown" };
  }

  private safeMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === "string") return response;
      if (typeof response === "object" && response !== null) {
        const resp = response as Record<string, unknown>;
        if (typeof resp.message === "string") return resp.message;
        if (Array.isArray(resp.message)) return (resp.message as string[]).join("; ");
      }
    }

    return "An unexpected error occurred";
  }
}
