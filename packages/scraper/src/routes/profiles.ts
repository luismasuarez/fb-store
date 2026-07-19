import { Hono } from "hono";
import type { Context } from "hono";
import { CreateProfileRequestSchema } from "../schemas";
import { listProfiles, createProfile, deleteProfile, checkSession } from "../services/profile-manager";
import { join } from "node:path";

type Variables = { requestId: string };

const profilesRoute = new Hono<{ Variables: Variables }>();

profilesRoute.get("/profiles", async (c: Context<{ Variables: Variables }>) => {
  const profiles = await listProfiles();
  return c.json({ data: { profiles } });
});

profilesRoute.post("/profiles", async (c: Context<{ Variables: Variables }>) => {
  const body = await c.req.json();
  const parsed = CreateProfileRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: { code: "validation", message: parsed.error.message, requestId: c.get("requestId") },
    }, 400);
  }

  const existing = await listProfiles();
  if (existing.some((p) => p.name === parsed.data.name)) {
    return c.json({
      error: { code: "business", message: "BUSINESS:Profile already exists", requestId: c.get("requestId") },
    }, 409);
  }

  const profile = await createProfile(parsed.data.name);
  const profileDir = process.env.PROFILE_DIR || "/app/profiles";

  return c.json({
    data: { name: profile.name, path: join(profileDir, profile.name) },
  }, 201);
});

profilesRoute.delete("/profiles/:name", async (c: Context<{ Variables: Variables }>) => {
  const name = c.req.param("name")!;

  try {
    await deleteProfile(name);
    return c.body(null, 204);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("BUSINESS:")) {
      return c.json({
        error: { code: "business", message: err.message, requestId: c.get("requestId") },
      }, 404);
    }
    throw err;
  }
});

profilesRoute.get("/profiles/:name/check", async (c: Context<{ Variables: Variables }>) => {
  const name = c.req.param("name")!;
  const result = await checkSession(name);
  return c.json({ data: { profile: name, ...result } });
});

export default profilesRoute;
