import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import type { FastifyRequest, FastifyReply } from "fastify";

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const requestId = (request as any).id || crypto.randomUUID();
    response.header("x-request-id", requestId);

    const start = Date.now();
    const { method, url } = request;
    const controller = context.getClass()?.name || "unknown";
    const handler = context.getHandler()?.name || "unknown";

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const statusCode = (response as any).statusCode || 200;
          this.logger.log(
            `${method} ${url} → ${statusCode} [${duration}ms] ${controller}.${handler}`,
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          const statusCode = err?.status || 500;
          this.logger.error(
            `${method} ${url} → ${statusCode} [${duration}ms] ${controller}.${handler}: ${err?.message}`,
          );
        },
      }),
    );
  }
}
