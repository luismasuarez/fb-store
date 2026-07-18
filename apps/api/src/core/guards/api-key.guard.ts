import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { AppConfigService } from "../../infrastructure/config/app-config.service";

export const SKIP_AUTH_KEY = "skipAuth";
export const SkipAuth = () => SetMetadata(SKIP_AUTH_KEY, true);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private config: AppConfigService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skipAuth = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipAuth) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const key = request.headers["x-api-key"];

    if (!key || key !== this.config.getRequiredString("API_KEY")) {
      throw new UnauthorizedException("Invalid or missing API key");
    }

    return true;
  }
}
