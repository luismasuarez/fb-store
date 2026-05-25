import { z } from "zod/v4";

export const AIProviderConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic", "openrouter"]),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});

export const FacebookAccountSchema = z.object({
  email: z.string().email(),
  profile: z.string().min(1),
});

export const GroupScrapeConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  maxPosts: z.number().int().min(1).max(100).default(30),
});

export const AppConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  AI_PROVIDER: z.enum(["openai", "anthropic", "openrouter"]).default("openrouter"),
  AI_MODEL: z.string().default("openai/gpt-4o-mini"),
  AI_API_KEY: z.string().default(""),
});
