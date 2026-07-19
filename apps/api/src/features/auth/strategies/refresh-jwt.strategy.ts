import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import type { FastifyRequest } from "fastify";
import { AppConfigService } from "../../../infrastructure/config/app-config.service";

interface JwtPayload {
  sub: string;
  typ: string;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(Strategy, "refresh-jwt") {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: (req: FastifyRequest) => {
        if (req.body && typeof req.body === "object" && "refreshToken" in req.body) {
          return (req.body as { refreshToken: string }).refreshToken;
        }
        return null;
      },
      ignoreExpiration: false,
      secretOrKey: config.getRequiredString("JWT_SECRET"),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (payload.typ !== "refresh") {
      throw new UnauthorizedException("Invalid token type");
    }
    return payload;
  }
}
