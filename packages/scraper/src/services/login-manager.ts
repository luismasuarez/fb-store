import { spawn } from "node:child_process";
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

function detectChrome(): string {
  return process.env.CHROME_PATH || "/usr/bin/chromium";
}

export async function startLogin(profile: string): Promise<LoginSession> {
  if (sessions.has(profile)) {
    const existing = sessions.get(profile)!;
    if (existing.state === "login-in-progress") {
      throw new Error("BUSINESS:Login already in progress");
    }
  }

  const profileDir = join(getProfileDir(), profile);
  const chromePath = detectChrome();
  const vncUrl = "http://scraper:6080/vnc.html?password=fbstore";

  const proc = spawn(chromePath, [
    `--display=:99`,
    `--user-data-dir=${profileDir}`,
    `--no-sandbox`,
    `--disable-gpu`,
    `--window-size=1280,900`,
    `https://facebook.com`,
  ], {
    stdio: "ignore",
  });

  const session: LoginSession = {
    profile,
    state: "login-in-progress",
    pid: proc.pid!,
    vncUrl,
    startedAt: new Date().toISOString(),
  };

  sessions.set(profile, session);

  proc.on("exit", () => {
    const s = sessions.get(profile);
    if (s && s.state === "login-in-progress") {
      sessions.set(profile, { ...s, state: "logged-in" });
    }
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

  try {
    process.kill(session.pid, "SIGTERM");
  } catch {
    // Process may already be dead
  }

  const profileDir = join(getProfileDir(), profile);
  await writeFile(join(profileDir, ".meta.json"), JSON.stringify({
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    loginStatus: "alive",
  }, null, 2));

  sessions.set(profile, { ...session, state: "logged-in" });
}

/** @internal */
export function _clearSessions(): void {
  sessions.clear();
}
