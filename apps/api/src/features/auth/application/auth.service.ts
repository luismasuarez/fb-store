import {
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { AppConfigService } from "../../../infrastructure/config/app-config.service";
import { TokenService } from "./token.service";
import { AuthSessionRepository } from "../infrastructure/auth-session.repository";
import { PrismaService } from "../../../infrastructure/database/prisma/prisma.service";
import type { LoginDto } from "../api/dto/login.dto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessExpiresIn: number;
  private readonly refreshExpiresIn: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly tokenService: TokenService,
    private readonly sessionRepo: AuthSessionRepository,
    private readonly prisma: PrismaService,
  ) {
    this.accessExpiresIn = this.config.getNumber("JWT_ACCESS_EXPIRES_IN", 86400);
    this.refreshExpiresIn = this.config.getNumber("JWT_REFRESH_EXPIRES_IN", 604800);
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !this.verifyPassword(dto.password, user.passwordHash)) {
      this.logger.warn(`Failed login attempt for email: ${dto.email}`);
      throw new UnauthorizedException("Invalid email or password");
    }

    const tokens = await this.generateTokenPair(user.id);
    this.logger.log(`Successful login for user: ${user.email}`);
    return tokens;
  }

  async refresh(
    refreshToken: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorizedException("Refresh token is invalid or has been revoked");
    }

    if (session.revokedAt) {
      throw new UnauthorizedException("Refresh token is invalid or has been revoked");
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or has been revoked");
    }

    await this.sessionRepo.revoke(session.id);

    const tokens = await this.generateTokenPair(session.userId);
    this.logger.log(`Token refreshed for user: ${session.userId}`);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    const active = await this.sessionRepo.findActiveByUser(userId);
    if (active) {
      await this.sessionRepo.revoke(active.id);
      this.logger.log(`Session revoked for user: ${userId}`);
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user;
  }

  private async generateTokenPair(userId: string) {
    const payload = { sub: userId };

    const accessToken = await this.jwtService.signAsync({
      ...payload,
      typ: "access",
      jti: randomBytes(16).toString("hex"),
    }, {
      expiresIn: this.accessExpiresIn,
    });

    const refreshToken = await this.jwtService.signAsync({
      ...payload,
      typ: "refresh",
      jti: randomBytes(16).toString("hex"),
    }, {
      expiresIn: this.refreshExpiresIn,
    });

    const tokenHash = this.tokenService.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpiresIn * 1000);

    await this.sessionRepo.create({
      userId,
      tokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiresIn,
    };
  }

  hashPassword(password: string): string {
    const salt = randomBytes(16);
    const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    return `scrypt:16384:8:1:${salt.toString("hex")}:${key.toString("hex")}`;
  }

  verifyPassword(password: string, stored: string): boolean {
    const parts = stored.split(":");
    if (parts[0] !== "scrypt" || parts.length !== 6) {
      return false;
    }
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = Buffer.from(parts[4], "hex");
    const expectedKey = Buffer.from(parts[5], "hex");

    const actualKey = scryptSync(password, salt, 64, { N, r, p });
    if (actualKey.length !== expectedKey.length) {
      return false;
    }
    return timingSafeEqual(actualKey, expectedKey);
  }
}
