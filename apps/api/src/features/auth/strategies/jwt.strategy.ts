import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AppConfigService } from "../../../infrastructure/config/app-config.service";

interface JwtPayload {
  sub: string;
  typ: string;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getRequiredString("JWT_SECRET"),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (payload.typ !== "access") {
      throw new UnauthorizedException("Invalid token type");
    }
    return payload;
  }
}
