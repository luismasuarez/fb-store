import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export type LoginState = "idle" | "login-in-progress" | "logged-in";

export interface LoginSession {
  profile: string;
  state: LoginState;
  pid: number;
  vncUrl: string;
  startedAt: string;
}

const sessions = new Map<string, LoginSession>();

function getProfileDir(): string {
  return process.env.PROFILE_DIR || "/app/profiles";
}

export async function startLogin(profile: string): Promise<LoginSession> {
  if (sessions.has(profile)) {
    const existing = sessions.get(profile)!;
    if (existing.state === "login-in-progress") {
      throw new Error("BUSINESS:Login already in progress");
    }
  }

  const profileDir = join(getProfileDir(), profile);
  const vncUrl = "http://scraper:6080/vnc.html?password=fbstore";
  const startedAt = new Date().toISOString();

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: "es-VE",
  });

  const page = await context.newPage();
  await page.goto("https://facebook.com", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  const session: LoginSession = {
    profile,
    state: "login-in-progress",
    pid: 0,
    vncUrl,
    startedAt,
  };

  sessions.set(profile, session);

  context.waitForEvent("close", { timeout: 0 }).then(async () => {
    sessions.set(profile, { ...session, state: "logged-in" });
    const now = new Date().toISOString();
    await writeFile(join(profileDir, ".meta.json"), JSON.stringify({
      createdAt: startedAt,
      lastUsedAt: now,
      loginStatus: "alive",
    }, null, 2)).catch(() => {});
  });

  return session;
}

export function getStatus(profile: string): LoginSession | undefined {
  return sessions.get(profile);
}

export async function completeLogin(profile: string): Promise<void> {
  const session = sessions.get(profile);
  if (!session) {
    throw new Error("BUSINESS:No active login session");
  }

  const profileDir = join(getProfileDir(), profile);
  await writeFile(join(profileDir, ".meta.json"), JSON.stringify({
    createdAt: session.startedAt,
    lastUsedAt: new Date().toISOString(),
    loginStatus: "alive",
  }, null, 2));

  sessions.set(profile, { ...session, state: "logged-in" });
}

/** @internal */
export function _clearSessions(): void {
  sessions.clear();
}
