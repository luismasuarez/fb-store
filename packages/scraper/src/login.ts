import { chromium } from "playwright";
import path from "node:path";

const PROFILE_DIR = path.resolve(process.cwd(), "profiles", "cuenta-1");

async function main() {
  console.log("🔐 FB Store — Setup de Login");
  console.log(`📁 Perfil: ${PROFILE_DIR}`);
  console.log("");

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: "es-VE",
  });

  const page = await context.newPage();
  await page.goto("https://facebook.com/", { waitUntil: "networkidle", timeout: 60000 });

  console.log("🌐 Navegador abierto. Inicia sesión en Facebook manualmente.");
  console.log("📌 Cuando termines, cierra la ventana del navegador.");
  console.log("✅ El perfil se guardará automáticamente.");

  await context.waitForEvent("close");
  console.log("💾 Perfil guardado en:", PROFILE_DIR);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
