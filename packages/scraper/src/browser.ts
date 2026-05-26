import { chromium, type BrowserContext } from "playwright";
import path from "node:path";

export async function createContext(profileDir: string): Promise<BrowserContext> {
  const dir = path.resolve(profileDir);
  return chromium.launchPersistentContext(dir, {
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: "es-Es",
    timezoneId: "America/Havana",
    bypassCSP: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
  });
}
