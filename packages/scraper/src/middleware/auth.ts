import type { Context, Next } from "hono";

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

if (!SCRAPER_API_KEY) {
  throw new Error("SCRAPER_API_KEY environment variable is required");
}

const PUBLIC_PATHS = new Set(["/health", "/ready"]);

export async function authMiddleware(
  c: Context<{ Variables: { requestId: string } }>,
  next: Next,
): Promise<Response | void> {
  const requestId = c.get("requestId");

  if (PUBLIC_PATHS.has(c.req.path)) {
    return next();
  }

  const apiKey = c.req.header("x-api-key");

  if (!apiKey || apiKey !== SCRAPER_API_KEY) {
    return c.json({
      error: {
        code: "unauthorized",
        message: "Invalid or missing x-api-key header",
        requestId,
      },
    }, 401);
  }

  return next();
}
