import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiKeyGuard, SKIP_AUTH_KEY } from "./api-key.guard";
import { AppConfigService } from "../../infrastructure/config/app-config.service";

describe("ApiKeyGuard", () => {
  let guard: ApiKeyGuard;
  let configService: { getRequiredString: vi.Mock };
  let reflector: { getAllAndOverride: vi.Mock };

  const mockContext = (headers: Record<string, string>, skipAuth = false) => {
    const handler = () => {};
    handler.toString = () => "handler";
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
      getHandler: () => handler,
      getClass: () => class TestController {},
    } as any;
  };

  beforeEach(() => {
    configService = { getRequiredString: vi.fn() };
    reflector = { getAllAndOverride: vi.fn() };

    guard = new ApiKeyGuard(
      configService as any,
      reflector as any,
    );
  });

  it("allows request with valid API key", () => {
    const context = mockContext({ "x-api-key": "valid-key" });
    configService.getRequiredString.mockReturnValue("valid-key");
    reflector.getAllAndOverride.mockReturnValue(false);

    expect(guard.canActivate(context)).toBe(true);
  });

  it("throws UnauthorizedException with missing key", () => {
    const context = mockContext({});
    configService.getRequiredString.mockReturnValue("valid-key");
    reflector.getAllAndOverride.mockReturnValue(false);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException with wrong key", () => {
    const context = mockContext({ "x-api-key": "wrong-key" });
    configService.getRequiredString.mockReturnValue("valid-key");
    reflector.getAllAndOverride.mockReturnValue(false);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("skips auth when @SkipAuth() present", () => {
    const context = mockContext({});
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
  });

  it("checks handler and class for SkipAuth", () => {
    const context = mockContext({ "x-api-key": "valid-key" });
    configService.getRequiredString.mockReturnValue("valid-key");
    reflector.getAllAndOverride.mockReturnValue(false);

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalled();
    expect(reflector.getAllAndOverride.mock.calls[0][0]).toBe(SKIP_AUTH_KEY);
  });
});
