import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./api/auth.controller";
import { AuthService } from "./application/auth.service";
import { TokenService } from "./application/token.service";
import { AuthSessionRepository } from "./infrastructure/auth-session.repository";
import { RefreshJwtStrategy } from "./strategies/refresh-jwt.strategy";
import { AppConfigModule } from "../../infrastructure/config/app-config.module";
import { AppConfigService } from "../../infrastructure/config/app-config.service";
import { PrismaModule } from "../../infrastructure/database/prisma/prisma.module";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      global: true,
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.getRequiredString("JWT_SECRET"),
        signOptions: {
          expiresIn: config.getNumber("JWT_ACCESS_EXPIRES_IN", 86400),
        },
      }),
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuthSessionRepository,
    RefreshJwtStrategy,
  ],
  exports: [JwtModule],
})
export class AuthModule {}
