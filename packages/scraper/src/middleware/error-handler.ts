import type { Context } from "hono";

export type ErrorCode = "validation" | "business" | "unknown";

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  };
}

const ERROR_MAP: { code: ErrorCode; status: 400 | 409 | 500; test: (e: Error) => boolean }[] = [
  { code: "validation", status: 400, test: (e) => e.name === "ZodError" },
  { code: "business", status: 409, test: (e) => e.message.startsWith("BUSINESS:") },
];

export function errorHandler(err: Error, c: Context<{ Variables: { requestId: string } }>): Response {
  const requestId = c.get("requestId");

  for (const entry of ERROR_MAP) {
    if (entry.test(err)) {
      return c.json({
        error: { code: entry.code, message: err.message, requestId },
      } satisfies ErrorEnvelope, entry.status);
    }
  }

  console.error(JSON.stringify({
    level: "error",
    msg: err.message,
    requestId,
    stack: err.stack,
  }));

  return c.json({
    error: { code: "unknown", message: "Internal server error", requestId },
  } satisfies ErrorEnvelope, 500);
}
