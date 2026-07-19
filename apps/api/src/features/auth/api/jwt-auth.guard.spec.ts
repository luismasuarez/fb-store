import { Test, type TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtStrategy } from "../strategies/jwt.strategy";
import { AppConfigService } from "../../../infrastructure/config/app-config.service";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;

  const mockConfig = {
    getRequiredString: vi.fn((key: string) => {
      if (key === "JWT_SECRET") return "test-secret";
      throw new Error(`Missing: ${key}`);
    }),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        JwtStrategy,
        { provide: AppConfigService, useValue: mockConfig },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("extends AuthGuard('jwt')", () => {
    expect(guard).toBeInstanceOf(JwtAuthGuard);
  });

  describe("handleRequest", () => {
    it("returns user when no error and user exists", () => {
      const user = { sub: "user-uuid", typ: "access" };
      const result = (guard as any).handleRequest(null, user, null);
      expect(result).toEqual(user);
    });

    it("throws UnauthorizedException when user is null", () => {
      expect(() => (guard as any).handleRequest(null, null, { message: "No auth token" }))
        .toThrow(UnauthorizedException);
    });

    it("throws the original error when present", () => {
      const error = new Error("Custom error");
      expect(() => (guard as any).handleRequest(error, null, null))
        .toThrow(error);
    });
  });
});
