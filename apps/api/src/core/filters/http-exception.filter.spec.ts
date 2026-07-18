import {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  HttpStatus,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { HttpExceptionFilter } from "./http-exception.filter";

describe("HttpExceptionFilter", () => {
  let filter: HttpExceptionFilter;
  let mockHttpAdapter: { reply: vi.Mock };
  let mockHost: any;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    mockHttpAdapter = { reply: vi.fn() };
    mockRequest = { id: "req_test123", url: "/api/test", method: "GET" };
    mockResponse = {};
    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    filter = new HttpExceptionFilter({
      httpAdapter: mockHttpAdapter,
    } as any);
  });

  it("formats validation error", () => {
    const exception = new BadRequestException("Validation failed");
    filter.catch(exception, mockHost);
    const [ctx, body, status] = mockHttpAdapter.reply.mock.calls[0];
    expect(status).toBe(400);
    expect(body.error.code).toBe("validation");
    expect(body.error.requestId).toBe("req_test123");
    expect(body.error.timestamp).toBeDefined();
  });

  it("formats authorization error", () => {
    const exception = new UnauthorizedException("Invalid API key");
    filter.catch(exception, mockHost);
    const [, body, status] = mockHttpAdapter.reply.mock.calls[0];
    expect(status).toBe(401);
    expect(body.error.code).toBe("authorization");
  });

  it("formats not found as business", () => {
    const exception = new NotFoundException("Resource not found");
    filter.catch(exception, mockHost);
    const [, body, status] = mockHttpAdapter.reply.mock.calls[0];
    expect(status).toBe(404);
    expect(body.error.code).toBe("business");
  });

  it("formats conflict as business", () => {
    const exception = new ConflictException("Duplicate entry");
    filter.catch(exception, mockHost);
    const [, body, status] = mockHttpAdapter.reply.mock.calls[0];
    expect(status).toBe(409);
    expect(body.error.code).toBe("business");
  });

  it("formats unprocessable as business", () => {
    const exception = new UnprocessableEntityException("Invalid state");
    filter.catch(exception, mockHost);
    const [, body, status] = mockHttpAdapter.reply.mock.calls[0];
    expect(status).toBe(422);
    expect(body.error.code).toBe("business");
  });

  it("formats unknown exception as 500 unknown", () => {
    const exception = new Error("Something broke");
    filter.catch(exception, mockHost);
    const [, body, status] = mockHttpAdapter.reply.mock.calls[0];
    expect(status).toBe(500);
    expect(body.error.code).toBe("unknown");
    expect(body.error.message).toBe("An unexpected error occurred");
  });

  it("never exposes stack traces", () => {
    const exception = new Error("Secret details");
    filter.catch(exception, mockHost);
    const [, body] = mockHttpAdapter.reply.mock.calls[0];
    expect(body.error.message).not.toContain("Secret details");
    expect(body.error.stack).toBeUndefined();
  });

  it("uses requestId from request", () => {
    mockRequest.id = "custom-req-id";
    const exception = new BadRequestException("fail");
    filter.catch(exception, mockHost);
    const [, body] = mockHttpAdapter.reply.mock.calls[0];
    expect(body.error.requestId).toBe("custom-req-id");
  });

  it("generates requestId if not present", () => {
    mockRequest.id = undefined;
    const exception = new BadRequestException("fail");
    filter.catch(exception, mockHost);
    const [, body] = mockHttpAdapter.reply.mock.calls[0];
    expect(body.error.requestId).toBeDefined();
    expect(typeof body.error.requestId).toBe("string");
  });
});
