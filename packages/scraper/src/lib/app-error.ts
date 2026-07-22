export type ErrorCode =
  | "validation_error"
  | "not_found"
  | "conflict"
  | "unauthorized"
  | "session_expired"
  | "network_error"
  | "external_error"
  | "internal_error"

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number = 500,
  ) {
    super(message)
    this.name = "AppError"
  }
}
