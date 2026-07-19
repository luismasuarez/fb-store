import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";
import { AuthSessionRepository } from "../infrastructure/auth-session.repository";
import { AppConfigService } from "../../../infrastructure/config/app-config.service";
import { PrismaService } from "../../../infrastructure/database/prisma/prisma.service";

const mockUser = {
  id: "user-uuid",
  email: "admin@example.com",
  passwordHash:
    "scrypt:16384:8:1:salt1234567890abcd:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  displayName: "Admin",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSession = {
  id: "session-uuid",
  userId: "user-uuid",
  tokenHash: "abc123",
  expiresAt: new Date(Date.now() + 604800000),
  revokedAt: null,
  createdAt: new Date(),
};

describe("AuthService", () => {
  let service: AuthService;
  let jwtService: JwtService;
  let config: AppConfigService;
  let tokenService: TokenService;
  let sessionRepo: AuthSessionRepository;
  let prisma: PrismaService;

  const mockJwtService = {
    signAsync: vi.fn().mockResolvedValue("mock-jwt-token"),
  };

  const mockConfig = {
    getRequiredString: vi.fn((key: string) => {
      if (key === "JWT_SECRET") return "test-secret";
      throw new Error(`Missing: ${key}`);
    }),
    getNumber: vi.fn((key: string, defaultValue?: number) => {
      if (key === "JWT_ACCESS_EXPIRES_IN") return 86400;
      if (key === "JWT_REFRESH_EXPIRES_IN") return 604800;
      return defaultValue;
    }),
    getString: vi.fn(),
  } as any;

  const mockTokenService = {
    hashToken: vi.fn((token: string) => `hashed-${token}`),
  };

  const mockSessionRepo = {
    findByTokenHash: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    findActiveByUser: vi.fn(),
  };

  const mockPrisma = {
    client: {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: AppConfigService, useValue: mockConfig },
        { provide: TokenService, useValue: mockTokenService },
        { provide: AuthSessionRepository, useValue: mockSessionRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    tokenService = module.get<TokenService>(TokenService);
    sessionRepo = module.get<AuthSessionRepository>(AuthSessionRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    const loginDto = { email: "admin@example.com", password: "password123" };

    it("returns tokens for valid credentials", async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue(mockUser);
      vi.spyOn(service as any, "verifyPassword").mockReturnValue(true);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe("mock-jwt-token");
      expect(result.refreshToken).toBe("mock-jwt-token");
      expect(result.expiresIn).toBe(86400);
      expect(mockSessionRepo.create).toHaveBeenCalled();
    });

    it("throws UnauthorizedException for wrong password", async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue(mockUser);
      vi.spyOn(service as any, "verifyPassword").mockReturnValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException for non-existent email", async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("returns same error message for wrong email and wrong password", async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        "Invalid email or password",
      );
    });
  });

  describe("refresh", () => {
    const refreshToken = "valid-refresh-token";

    it("returns new tokens for a valid refresh token", async () => {
      mockSessionRepo.findByTokenHash.mockResolvedValue(mockSession);

      const result = await service.refresh(refreshToken);

      expect(result.accessToken).toBe("mock-jwt-token");
      expect(result.refreshToken).toBe("mock-jwt-token");
      expect(mockSessionRepo.revoke).toHaveBeenCalledWith(mockSession.id);
      expect(mockSessionRepo.create).toHaveBeenCalled();
    });

    it("throws UnauthorizedException for unknown token hash", async () => {
      mockSessionRepo.findByTokenHash.mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException for revoked session", async () => {
      mockSessionRepo.findByTokenHash.mockResolvedValue({
        ...mockSession,
        revokedAt: new Date(),
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException for expired session", async () => {
      mockSessionRepo.findByTokenHash.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("logout", () => {
    it("revokes the active session", async () => {
      mockSessionRepo.findActiveByUser.mockResolvedValue(mockSession);

      await service.logout("user-uuid");

      expect(mockSessionRepo.revoke).toHaveBeenCalledWith(mockSession.id);
    });

    it("does nothing if no active session", async () => {
      mockSessionRepo.findActiveByUser.mockResolvedValue(null);

      await service.logout("user-uuid");

      expect(mockSessionRepo.revoke).not.toHaveBeenCalled();
    });
  });

  describe("getMe", () => {
    it("returns user profile for valid userId", async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue({
        id: "user-uuid",
        email: "admin@example.com",
        displayName: "Admin",
      });

      const result = await service.getMe("user-uuid");

      expect(result.email).toBe("admin@example.com");
      expect(result.displayName).toBe("Admin");
    });

    it("throws UnauthorizedException for unknown user", async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe("unknown")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("hashPassword and verifyPassword", () => {
    it("hashPassword produces a valid scrypt hash", () => {
      const hash = (service as any).hashPassword("test-password");
      expect(hash).toMatch(
        /^scrypt:\d+:\d+:\d+:[a-f0-9]+:[a-f0-9]+$/,
      );
    });

    it("verifyPassword returns true for correct password", () => {
      const password = "test-password";
      const hash = (service as any).hashPassword(password);
      const result = (service as any).verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it("verifyPassword returns false for wrong password", () => {
      const password = "test-password";
      const hash = (service as any).hashPassword(password);
      const result = (service as any).verifyPassword("wrong-password", hash);
      expect(result).toBe(false);
    });

    it("verifyPassword returns false for malformed hash", () => {
      const result = (service as any).verifyPassword("password", "invalid:hash");
      expect(result).toBe(false);
    });
  });
});
