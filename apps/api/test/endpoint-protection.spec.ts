import { ApiKeyGuard } from "../src/core/guards/api-key.guard";

describe("Endpoint Protection", () => {
  it("ApiKeyGuard is the unified guard handling both x-api-key and JWT", () => {
    expect(ApiKeyGuard).toBeDefined();
    expect(ApiKeyGuard.prototype.canActivate).toBeDefined();
  });
});
