import { Hono } from "hono";

const startTime = Date.now();

const healthRoute = new Hono();

healthRoute.get("/health", (c) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  return c.json({
    uptime,
    profiles: { count: 0 },
    chrome: { status: "unknown" },
    display: { status: "unknown" },
  });
});

healthRoute.get("/ready", (c) => {
  return c.json({ ready: true });
});

export default healthRoute;
