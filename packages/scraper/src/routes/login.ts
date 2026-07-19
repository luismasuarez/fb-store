import { Hono } from "hono";
import type { Context } from "hono";
import { LoginRequestSchema } from "../schemas";
import * as loginManager from "../services/login-manager";
import { listProfiles } from "../services/profile-manager";

type Variables = { requestId: string };

const loginRoute = new Hono<{ Variables: Variables }>();

loginRoute.post("/login", async (c: Context<{ Variables: Variables }>) => {
  const body = await c.req.json();
  const parsed = LoginRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: { code: "validation", message: parsed.error.message, requestId: c.get("requestId") },
    }, 400);
  }

  const { profile } = parsed.data;

  const profiles = await listProfiles();
  if (!profiles.some((p) => p.name === profile)) {
    return c.json({
      error: { code: "business", message: "BUSINESS:Profile not found", requestId: c.get("requestId") },
    }, 400);
  }

  try {
    const session = await loginManager.startLogin(profile);
    return c.json({
      data: { profile: session.profile, vncUrl: session.vncUrl, state: session.state },
    }, 201);
  } catch (err) {
    if (err instanceof Error && err.message === "BUSINESS:Login already in progress") {
      return c.json({
        error: { code: "business", message: err.message, requestId: c.get("requestId") },
      }, 409);
    }
    throw err;
  }
});

loginRoute.get("/login/:profile/status", async (c: Context<{ Variables: Variables }>) => {
  const profile = c.req.param("profile")!;
  const session = loginManager.getStatus(profile);

  if (!session) {
    return c.json({
      data: { profile, state: "idle" },
    });
  }

  return c.json({
    data: { profile: session.profile, state: session.state, vncUrl: session.vncUrl, startedAt: session.startedAt },
  });
});

loginRoute.post("/login/:profile/complete", async (c: Context<{ Variables: Variables }>) => {
  const profile = c.req.param("profile")!;

  try {
    await loginManager.completeLogin(profile);
    return c.json({
      data: { profile, state: "logged-in" },
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("BUSINESS:")) {
      return c.json({
        error: { code: "business", message: err.message, requestId: c.get("requestId") },
      }, 404);
    }
    throw err;
  }
});

export default loginRoute;
