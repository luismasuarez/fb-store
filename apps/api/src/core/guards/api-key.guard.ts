import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { FastifyRequest } from "fastify";
import { AppConfigService } from "../../infrastructure/config/app-config.service";

export const SKIP_AUTH_KEY = "skipAuth";
export const SkipAuth = () => SetMetadata(SKIP_AUTH_KEY, true);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private config: AppConfigService,
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipAuth = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipAuth) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const apiKey = request.headers["x-api-key"];

    if (apiKey && apiKey === this.config.getRequiredString("API_KEY")) {
      return true;
    }

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const payload = await this.jwtService.verifyAsync(token);
        if (payload.typ === "access") {
          (request as any).user = payload;
          return true;
        }
      } catch {
        // JWT inválido — continuar al throw
      }
    }

    throw new UnauthorizedException("Invalid or missing authentication");
  }
}
