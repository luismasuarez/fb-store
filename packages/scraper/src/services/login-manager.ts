import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { detectChrome } from "../browser";

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

  const chromePath = detectChrome();
  if (!chromePath) {
    throw new Error("BUSINESS:Chrome binary not found. Login requires Docker with Chrome installed.");
  }

  const profileDir = join(getProfileDir(), profile);
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

  proc.on("error", () => {
    sessions.delete(profile);
  });

  proc.on("exit", (code) => {
    if (code !== 0) {
      sessions.delete(profile);
      return;
    }
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
