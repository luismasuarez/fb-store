export type AIProviderName = "openai" | "anthropic" | "openrouter";

export interface AIProviderConfig {
  provider: AIProviderName;
  apiKey: string;
  model: string;
}

export interface AppConfig {
  db: { url: string };
  redis: { url: string };
  ai: AIProviderConfig;
  facebook: {
    accounts: FacebookAccountConfig[];
    activeAccountIndex: number;
    groups: GroupScrapeConfig[];
  };
  scrape: {
    intervalMinutes: number;
    hoursStart: number;
    hoursEnd: number;
  };
}

export interface FacebookAccountConfig {
  email: string;
  profile: string;
}

export interface GroupScrapeConfig {
  id: string;
  name: string;
  maxPosts: number;
}
