import { of, lastValueFrom } from "rxjs";
import { RequestIdInterceptor } from "./request-id.interceptor";

describe("RequestIdInterceptor", () => {
  let interceptor: RequestIdInterceptor;
  let mockRequest: any;
  let mockResponse: any;
  let mockContext: any;
  let mockCallHandler: any;

  beforeEach(() => {
    interceptor = new RequestIdInterceptor();
    mockRequest = { id: "req-abc", method: "GET", url: "/api/test" };
    mockResponse = { header: vi.fn() };
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getClass: () => class TestController {},
      getHandler: () => ({ name: "testHandler" }),
    };
    mockCallHandler = { handle: () => of({ data: "ok" }) };
  });

  it("sets x-request-id header from request.id", async () => {
    const obs = interceptor.intercept(mockContext, mockCallHandler);
    await lastValueFrom(obs);
    expect(mockResponse.header).toHaveBeenCalledWith("x-request-id", "req-abc");
  });

  it("generates requestId if request.id is missing", async () => {
    mockRequest.id = undefined;
    const obs = interceptor.intercept(mockContext, mockCallHandler);
    await lastValueFrom(obs);
    const call = mockResponse.header.mock.calls[0];
    expect(call[0]).toBe("x-request-id");
    expect(typeof call[1]).toBe("string");
    expect(call[1].length).toBeGreaterThan(0);
  });

  it("passes through the response data", async () => {
    const obs = interceptor.intercept(mockContext, mockCallHandler);
    const result = await lastValueFrom(obs);
    expect(result).toEqual({ data: "ok" });
  });
});
