import { chromium, type BrowserContext } from "playwright";
import path from "node:path";
import { existsSync } from "node:fs";

const PROJECT_ROOT = process.env.INIT_CWD || process.cwd();

function detectChrome(): string | undefined {
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
  return path.resolve(PROJECT_ROOT, "profiles", name);
}

export async function createContext(profileDir: string): Promise<BrowserContext> {
  const dir = path.resolve(PROJECT_ROOT, profileDir);
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
