import { Test, type TestingModule } from "@nestjs/testing";
import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "../src/features/auth/api/jwt-auth.guard";
import { JwtStrategy } from "../src/features/auth/strategies/jwt.strategy";
import { AppConfigService } from "../src/infrastructure/config/app-config.service";
import type { FastifyInstance } from "fastify";

@Controller("_test/endpoint-protection")
class TestController {
  @Get("public")
  getPublic() {
    return { data: "public-ok" };
  }

  @Get("protected")
  @UseGuards(JwtAuthGuard)
  getProtected() {
    return { data: "protected-ok" };
  }

  @Post("protected")
  @UseGuards(JwtAuthGuard)
  postProtected() {
    return { data: "protected-ok" };
  }
}

describe("Endpoint Protection", () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;

  const mockConfig: Partial<AppConfigService> = {
    getRequiredString: vi.fn((key: string) => {
      if (key === "JWT_SECRET") return "test-secret";
      if (key === "API_KEY") return "test-api-key";
      throw new Error(`Missing: ${key}`);
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: "test-secret",
          signOptions: { expiresIn: "1h" },
        }),
      ],
      controllers: [TestController],
      providers: [
        JwtAuthGuard,
        JwtStrategy,
        { provide: AppConfigService, useValue: mockConfig },
      ],
    }).compile();

    app = module.createNestApplication(new FastifyAdapter());
    jwtService = module.get<JwtService>(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function getServer(): FastifyInstance {
    return app.getHttpAdapter().getInstance() as FastifyInstance;
  }

  describe("Public routes", () => {
    it("allows GET without token", async () => {
      const res = await getServer().inject({
        method: "GET",
        url: "/_test/endpoint-protection/public",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ data: "public-ok" });
    });
  });

  describe("Protected routes reject unauthenticated requests", () => {
    it("rejects GET without token", async () => {
      const res = await getServer().inject({
        method: "GET",
        url: "/_test/endpoint-protection/protected",
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects POST without token", async () => {
      const res = await getServer().inject({
        method: "POST",
        url: "/_test/endpoint-protection/protected",
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects malformed token", async () => {
      const res = await getServer().inject({
        method: "GET",
        url: "/_test/endpoint-protection/protected",
        headers: { authorization: "Bearer invalid-token" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("Protected routes accept valid access tokens", () => {
    it("allows GET with valid access token", async () => {
      const token = jwtService.sign({ sub: "test-user", typ: "access" });
      const res = await getServer().inject({
        method: "GET",
        url: "/_test/endpoint-protection/protected",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ data: "protected-ok" });
    });

    it("allows POST with valid access token", async () => {
      const token = jwtService.sign({ sub: "test-user", typ: "access" });
      const res = await getServer().inject({
        method: "POST",
        url: "/_test/endpoint-protection/protected",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ data: "protected-ok" });
    });
  });

  describe("Protected routes reject non-access tokens", () => {
    it("rejects refresh token type", async () => {
      const token = jwtService.sign({ sub: "test-user", typ: "refresh" });
      const res = await getServer().inject({
        method: "GET",
        url: "/_test/endpoint-protection/protected",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects token with missing typ claim", async () => {
      const token = jwtService.sign({ sub: "test-user" });
      const res = await getServer().inject({
        method: "GET",
        url: "/_test/endpoint-protection/protected",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
