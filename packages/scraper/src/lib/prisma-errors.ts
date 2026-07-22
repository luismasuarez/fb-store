import { AppError, type ErrorCode } from "./app-error"

const PRISMA_CODES: Record<string, { code: ErrorCode; status: number; message: string }> = {
  P2002: { code: "conflict", status: 409, message: "A record with this ID already exists" },
  P2025: { code: "not_found", status: 404, message: "Record not found" },
  P2003: { code: "validation_error", status: 400, message: "Referenced record does not exist" },
  P2014: { code: "validation_error", status: 400, message: "Invalid relationship constraint" },
}

const ARGUMENT_MISSING_RE = /Argument `(\w+)` is missing/

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  const prismaErr = err as { code?: string; message?: string }

  if (prismaErr.code && PRISMA_CODES[prismaErr.code]) {
    const mapped = PRISMA_CODES[prismaErr.code]
    return new AppError(mapped.code, mapped.message, mapped.status)
  }

  const msg = prismaErr.message ?? ""
  const argMatch = msg.match(ARGUMENT_MISSING_RE)
  if (argMatch) {
    return new AppError("validation_error", `Missing required field: ${argMatch[1]}`, 400)
  }

  if (msg.startsWith("BUSINESS:")) {
    return new AppError("validation_error", msg.replace(/^BUSINESS:/, ""), 400)
  }

  if (/net::|enotfound|econnrefused|etimedout|econnreset|err_connection|err_name_not_resolved/i.test(msg)) {
    return new AppError("network_error", "Cannot connect to Facebook. Check your internet connection.", 502)
  }

  if (/login|session expired|redirected to login|not logged in/i.test(msg)) {
    return new AppError("session_expired", "Facebook login session has expired. Please re-login.", 401)
  }

  if (/prisma|p1001|p1002|can't reach database/i.test(msg)) {
    return new AppError("external_error", "Database is not available. Try again later.", 503)
  }

  return new AppError("internal_error", "Internal server error", 500)
}
