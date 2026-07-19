import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.env.INIT_CWD || process.cwd(), ".env") });

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { errorHandler } from "./middleware/error-handler";
import { authMiddleware } from "./middleware/auth";
import healthRoute from "./routes/health";
import scrapeRoute from "./routes/scrape";
import profilesRoute from "./routes/profiles";
import loginRoute from "./routes/login";

const PORT = Number(process.env.PORT) || 3001;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

if (!SCRAPER_API_KEY) {
  console.error(JSON.stringify({ level: "error", msg: "SCRAPER_API_KEY environment variable is required" }));
  process.exit(1);
}

type Variables = {
  requestId: string;
};

const app = new Hono<{ Variables: Variables }>();

app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
});

const staticDir = existsSync(resolve(__dirname, "static"))
  ? resolve(__dirname, "static")
  : resolve(__dirname, "..", "src", "static");

app.get("/dashboard", async (c) => {
  const html = readFileSync(resolve(staticDir, "dashboard.html"), "utf-8")
    .replace("__SCRAPER_API_KEY__", SCRAPER_API_KEY);
  return c.html(html);
});

app.use("/static/*", serveStatic({ root: staticDir }));

app.use("/api/*", authMiddleware);

app.route("/", healthRoute);
app.route("/api/v1", scrapeRoute);
app.route("/api/v1", profilesRoute);
app.route("/api/v1", loginRoute);

app.onError(errorHandler);

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(JSON.stringify({
    level: "info",
    msg: "Server started",
    port: info.port,
    pid: process.pid,
  }));
});
