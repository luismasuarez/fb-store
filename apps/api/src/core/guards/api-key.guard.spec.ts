import { Test, type TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ApiKeyGuard, SKIP_AUTH_KEY } from "./api-key.guard";
import { AppConfigService } from "../../infrastructure/config/app-config.service";

describe("ApiKeyGuard", () => {
  let guard: ApiKeyGuard;
  let reflector: Reflector;
  let mockContext: any;

  const mockConfig = {
    getRequiredString: vi.fn((key: string) => {
      if (key === "API_KEY") return "valid-key";
      if (key === "JWT_SECRET") return "test-secret";
      throw new Error(`Missing: ${key}`);
    }),
  };

  const mockJwtService = {
    verifyAsync: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        Reflector,
        { provide: AppConfigService, useValue: mockConfig },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
    reflector = module.get<Reflector>(Reflector);

    mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("API key auth", () => {
    it("allows request with valid API key", async () => {
      mockContext.switchToHttp = () => ({
        getRequest: () => ({ headers: { "x-api-key": "valid-key" } }),
      });

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it("throws UnauthorizedException with missing key", async () => {
      mockContext.switchToHttp = () => ({
        getRequest: () => ({ headers: {} }),
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException with wrong key", async () => {
      mockContext.switchToHttp = () => ({
        getRequest: () => ({ headers: { "x-api-key": "wrong-key" } }),
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("JWT auth", () => {
    it("allows request with valid Bearer token", async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: "user-uuid",
        typ: "access",
      });
      mockContext.switchToHttp = () => ({
        getRequest: () => ({
          headers: { authorization: "Bearer valid.jwt.token" },
        }),
      });

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it("rejects Bearer token with wrong typ", async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: "user-uuid",
        typ: "refresh",
      });
      mockContext.switchToHttp = () => ({
        getRequest: () => ({
          headers: { authorization: "Bearer refresh.token.here" },
        }),
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects expired/invalid JWT", async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error("jwt expired"));
      mockContext.switchToHttp = () => ({
        getRequest: () => ({
          headers: { authorization: "Bearer expired.token.here" },
        }),
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("@SkipAuth()", () => {
    it("skips auth when @SkipAuth() present", async () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });
});
