import { config } from "dotenv";
import { chromium, type BrowserContext } from "playwright";
import path from "node:path";
import { existsSync } from "node:fs";

const PACKAGE_ROOT = path.resolve(__dirname, "..");
config({ path: path.resolve(PACKAGE_ROOT, ".env") });

export function detectChrome(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return undefined;
}

export function getProfileDir(name: string): string {
  const base = process.env.PROFILE_DIR || path.resolve(PACKAGE_ROOT, "profiles");
  return path.resolve(base, name);
}

export function getProfileBaseDir(): string {
  return process.env.PROFILE_DIR || path.resolve(PACKAGE_ROOT, "profiles");
}

export async function createContext(profileDir: string): Promise<BrowserContext> {
  const dir = path.resolve(PACKAGE_ROOT, profileDir);
  const executablePath = detectChrome();

  return chromium.launchPersistentContext(dir, {
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: "es-VE",
    timezoneId: "America/Caracas",
    bypassCSP: true,
    executablePath,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
  });
}
