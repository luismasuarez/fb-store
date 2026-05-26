import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.env.INIT_CWD || process.cwd(), ".env") });

export interface AppConfig {
  providerName: string;
  apiKey: string;
  model: string;
  batchSize: number;
}

export function loadConfig(): AppConfig {
  const providerName = process.env.AI_PROVIDER || "openrouter";
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || "";
  const model = process.env.AI_MODEL || "openai/gpt-4o-mini";
  const batchSize = Number(process.env.AI_BATCH_SIZE) || 10;

  if (!apiKey) {
    console.error("❌ OPENROUTER_API_KEY o AI_API_KEY no configurada en .env");
    process.exit(1);
  }

  return { providerName, apiKey, model, batchSize };
}
