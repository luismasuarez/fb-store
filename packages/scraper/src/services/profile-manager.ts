import { readdir, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createContext, getProfileBaseDir } from "../browser";

export interface ProfileMeta {
  createdAt: string;
  lastUsedAt?: string;
  loginStatus: "unknown" | "alive" | "dead" | "locked";
}

export interface Profile {
  name: string;
  createdAt: string;
  lastUsedAt?: string;
  loginStatus: ProfileMeta["loginStatus"];
}

export interface SessionCheckResult {
  alive: boolean;
  reason: "feed-visible" | "redirected-to-login" | "network-error" | "chrome-error";
  checkedAt: string;
}

function getProfileDirFromEnv(): string {
  return getProfileBaseDir();
}

export async function listProfiles(): Promise<Profile[]> {
  const profileDir = getProfileDirFromEnv();
  let entries;
  try {
    entries = await readdir(profileDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const profiles: Profile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const metaPath = join(profileDir, entry.name, ".meta.json");
      try {
        const metaRaw = await readFile(metaPath, "utf-8");
        const meta: ProfileMeta = JSON.parse(metaRaw);
        profiles.push({
          name: entry.name,
          createdAt: meta.createdAt,
          lastUsedAt: meta.lastUsedAt,
          loginStatus: meta.loginStatus,
        });
      } catch {
        profiles.push({
          name: entry.name,
          createdAt: new Date().toISOString(),
          loginStatus: "unknown",
        });
      }
    }
  }

  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createProfile(name: string): Promise<Profile> {
  const profileDir = getProfileDirFromEnv();
  const dir = join(profileDir, name);

  try {
    await readdir(dir);
    throw new Error("BUSINESS:Profile already exists");
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("BUSINESS:")) throw err;
  }

  await mkdir(dir, { recursive: true });

  const meta: ProfileMeta = {
    createdAt: new Date().toISOString(),
    loginStatus: "unknown",
  };

  await writeFile(join(dir, ".meta.json"), JSON.stringify(meta, null, 2));

  return {
    name,
    createdAt: meta.createdAt,
    loginStatus: meta.loginStatus,
  };
}

export async function deleteProfile(name: string): Promise<void> {
  const profileDir = getProfileDirFromEnv();
  const dir = join(profileDir, name);

  try {
    await readdir(dir);
  } catch {
    throw new Error("BUSINESS:Profile not found");
  }

  await rm(dir, { recursive: true, force: true });
}

async function updateProfileMeta(name: string, updates: Partial<ProfileMeta>): Promise<void> {
  const profileDir = getProfileDirFromEnv();
  const metaPath = join(profileDir, name, ".meta.json");
  let meta: ProfileMeta;
  try {
    const raw = await readFile(metaPath, "utf-8");
    meta = { ...JSON.parse(raw), ...updates };
  } catch {
    meta = { createdAt: new Date().toISOString(), ...updates } as ProfileMeta;
  }
  await writeFile(metaPath, JSON.stringify(meta, null, 2));
}

export async function checkSession(name: string): Promise<SessionCheckResult> {
  const checkedAt = new Date().toISOString();
  const profileDir = getProfileDirFromEnv();
  const dir = join(profileDir, name);

  try {
    await readdir(dir);
  } catch {
    return { alive: false, reason: "chrome-error", checkedAt };
  }

  try {
    const context = await createContext(dir);
    const page = await context.newPage();

    try {
      await page.goto("https://facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(5000);

      const currentUrl = page.url();
      const isLoginUrl = currentUrl.includes("/login/") || currentUrl.includes("login");

      const domState = await page.evaluate(() => {
        const hasFeed = !!(
          document.querySelector('[role="feed"]') ||
          document.querySelector('[aria-label*="Feed"]') ||
          document.querySelector('[aria-label*="News Feed"]')
        );
        const hasLoggedInMenu = !!(
          document.querySelector('[aria-label="Your profile"]') ||
          document.querySelector('[aria-label="Account"]') ||
          document.querySelector('[data-pagelet="LeftNav"]') ||
          document.querySelector('[role="navigation"] [aria-label]')
        );
        const hasEmailInput = !!document.querySelector('input[name="email"]');
        const hasPassInput = !!document.querySelector('input[name="pass"]');
        const hasLoginButton = !!(
          document.querySelector('button[name="login"]') ||
          document.querySelector('[data-testid*="login"]')
        );
        const hasCreateAccount = !!(
          document.querySelector('a[href*="/reg/"]') ||
          document.querySelector('[data-testid*="signup"]')
        );
        return { hasFeed, hasLoggedInMenu, hasEmailInput, hasPassInput, hasLoginButton, hasCreateAccount };
      });

      if (domState.hasFeed || domState.hasLoggedInMenu) {
        await updateProfileMeta(name, { loginStatus: "alive", lastUsedAt: checkedAt });
        return { alive: true, reason: "feed-visible", checkedAt };
      }

      if (isLoginUrl || domState.hasEmailInput || domState.hasPassInput || domState.hasLoginButton || domState.hasCreateAccount) {
        await updateProfileMeta(name, { loginStatus: "dead", lastUsedAt: checkedAt });
        return { alive: false, reason: "redirected-to-login", checkedAt };
      }

      await updateProfileMeta(name, { loginStatus: "dead", lastUsedAt: checkedAt });
      return { alive: false, reason: "redirected-to-login", checkedAt };
    } finally {
      await page.close();
      await context.close();
    }
  } catch {
    return { alive: false, reason: "network-error", checkedAt };
  }
}
