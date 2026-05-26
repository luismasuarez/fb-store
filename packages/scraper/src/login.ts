import { config } from "dotenv";
import { chromium } from "playwright";
import path from "node:path";
import { existsSync } from "node:fs";

const PROJECT_ROOT = process.env.INIT_CWD || process.cwd();
config({ path: path.resolve(PROJECT_ROOT, ".env") });
const PROFILE_DIR = path.resolve(PROJECT_ROOT, "profiles", "cuenta-1");

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

async function main() {
  const executablePath = detectChrome();
  console.log("🔐 FB Store — Setup de Login");
  console.log(`📁 Perfil: ${PROFILE_DIR}`);
  if (executablePath) {
    console.log(`🔧 Chrome detectado: ${executablePath}`);
  } else {
    console.log("⚠️  No se encontró Chrome. Asegurate de tenerlo instalado.");
  }
  console.log("");

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: "es-VE",
    executablePath,
  });

  const page = await context.newPage();
  await page.goto("https://facebook.com/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  console.log("🌐 Navegador abierto — iniciá sesión en Facebook manualmente.");
  console.log("📌 Cuando termines, cerrá la ventana del navegador.");
  console.log("✅ El perfil se guardará automáticamente.");

  await context.waitForEvent("close", { timeout: 0 });
  console.log("💾 Perfil guardado en:", PROFILE_DIR);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
