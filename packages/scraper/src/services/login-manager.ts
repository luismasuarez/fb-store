import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { readdirSync } from "node:fs";

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

function findSystemChrome(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/brave-browser-stable",
    "/usr/bin/brave-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  const pwDir = join(homedir(), ".cache", "ms-playwright");
  try {
    const entries = readdirSync(pwDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const p = join(pwDir, entry.name, "chrome-linux64", "chrome");
        if (existsSync(p)) return p;
        const pAlt = join(pwDir, entry.name, "chrome-linux", "chrome");
        if (existsSync(pAlt)) return pAlt;
      }
    }
  } catch {}
  return undefined;
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

  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      locale: "es-VE",
    });
  } catch {
    const systemChrome = findSystemChrome();
    if (!systemChrome) {
      throw new Error("BUSINESS:No Chromium disponible para login. Ejecuta: npx playwright install chromium");
    }
    context = await chromium.launchPersistentContext(profileDir, {
      executablePath: systemChrome,
      headless: false,
      viewport: { width: 1280, height: 900 },
      locale: "es-VE",
    });
  }

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
