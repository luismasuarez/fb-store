import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AppConfigService } from "./app-config.service";

describe("AppConfigService", () => {
  let service: AppConfigService;
  let configService: { get: vi.Mock };

  beforeEach(async () => {
    configService = { get: vi.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
  });

  describe("getString", () => {
    it("returns value when key exists", () => {
      configService.get.mockReturnValue("my-value");
      expect(service.getString("MY_KEY")).toBe("my-value");
    });

    it("returns default when key missing", () => {
      configService.get.mockReturnValue(undefined);
      expect(service.getString("MY_KEY", "default")).toBe("default");
    });

    it("returns undefined when key missing and no default", () => {
      configService.get.mockReturnValue(undefined);
      expect(service.getString("MY_KEY")).toBeUndefined();
    });
  });

  describe("getRequiredString", () => {
    it("returns value when key exists", () => {
      configService.get.mockReturnValue("my-value");
      expect(service.getRequiredString("MY_KEY")).toBe("my-value");
    });

    it("throws when key missing", () => {
      configService.get.mockReturnValue(undefined);
      expect(() => service.getRequiredString("MY_KEY")).toThrow(
        "Missing required env var: MY_KEY",
      );
    });
  });

  describe("getNumber", () => {
    it("returns parsed number", () => {
      configService.get.mockReturnValue("42");
      expect(service.getNumber("MY_KEY")).toBe(42);
    });

    it("returns default when key missing", () => {
      configService.get.mockReturnValue(undefined);
      expect(service.getNumber("MY_KEY", 10)).toBe(10);
    });

    it("returns undefined when key missing and no default", () => {
      configService.get.mockReturnValue(undefined);
      expect(service.getNumber("MY_KEY")).toBeUndefined();
    });
  });

  describe("getBoolean", () => {
    it("returns true for 'true'", () => {
      configService.get.mockReturnValue("true");
      expect(service.getBoolean("MY_KEY")).toBe(true);
    });

    it("returns false for 'false'", () => {
      configService.get.mockReturnValue("false");
      expect(service.getBoolean("MY_KEY")).toBe(false);
    });

    it("returns default when key missing", () => {
      configService.get.mockReturnValue(undefined);
      expect(service.getBoolean("MY_KEY", true)).toBe(true);
    });
  });

  describe("validateRequired", () => {
    it("passes when all required vars present", () => {
      configService.get.mockReturnValue("some-value");
      expect(() => service.validateRequired()).not.toThrow();
    });

    it("throws when DATABASE_URL missing", () => {
      configService.get.mockImplementation((key: string) =>
        key === "DATABASE_URL" ? undefined : "present",
      );
      expect(() => service.validateRequired()).toThrow(
        "Missing required environment variables: DATABASE_URL",
      );
    });

    it("throws when REDIS_URL missing", () => {
      configService.get.mockImplementation((key: string) =>
        key === "REDIS_URL" ? undefined : "present",
      );
      expect(() => service.validateRequired()).toThrow(
        "Missing required environment variables: REDIS_URL",
      );
    });

    it("throws when API_KEY missing", () => {
      configService.get.mockImplementation((key: string) =>
        key === "API_KEY" ? undefined : "present",
      );
      expect(() => service.validateRequired()).toThrow(
        "Missing required environment variables: API_KEY",
      );
    });

    it("throws when multiple vars missing", () => {
      configService.get.mockReturnValue(undefined);
      expect(() => service.validateRequired()).toThrow(
        "Missing required environment variables: DATABASE_URL, REDIS_URL, API_KEY, OPENROUTER_API_KEY",
      );
    });
  });
});
