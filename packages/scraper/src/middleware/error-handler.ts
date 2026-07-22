import type { Context } from "hono"
import { AppError } from "../lib/app-error"
import { toAppError } from "../lib/prisma-errors"

export interface ErrorEnvelope {
  error: {
    code: string
    message: string
    requestId: string
  }
}

const KNOWN_CODES = new Set([
  "validation_error", "not_found", "conflict",
  "unauthorized", "session_expired", "network_error",
  "external_error", "internal_error",
])

export function errorHandler(err: Error, c: Context<{ Variables: { requestId: string } }>): Response {
  const requestId = c.get("requestId")

  if (err instanceof AppError) {
    return c.json({
      error: { code: err.code, message: err.message, requestId },
    } satisfies ErrorEnvelope, err.status)
  }

  if (err.name === "ZodError") {
    return c.json({
      error: { code: "validation_error", message: err.message, requestId },
    } satisfies ErrorEnvelope, 400)
  }

  const appError = toAppError(err)

  if (appError.code !== "internal_error") {
    return c.json({
      error: { code: appError.code, message: appError.message, requestId },
    } satisfies ErrorEnvelope, appError.status)
  }

  console.error(JSON.stringify({
    level: "error",
    msg: err.message,
    requestId,
    stack: err.stack,
  }))

  return c.json({
    error: { code: "internal_error", message: "Internal server error", requestId },
  } satisfies ErrorEnvelope, 500)
}
