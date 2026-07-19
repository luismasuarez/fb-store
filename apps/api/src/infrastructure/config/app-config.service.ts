import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  getString(key: string, defaultValue?: string): string | undefined {
    return this.configService.get<string>(key) ?? defaultValue;
  }

  getRequiredString(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required env var: ${key}`);
    }
    return value;
  }

  getNumber(key: string, defaultValue?: number): number | undefined {
    const value = this.configService.get<string>(key);
    return value ? Number(value) : defaultValue;
  }

  getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    const value = this.configService.get<string>(key);
    return value !== undefined ? value === "true" : defaultValue;
  }

  validateRequired() {
    const required = [
      "DATABASE_URL",
      "REDIS_URL",
      "API_KEY",
      "OPENROUTER_API_KEY",
      "JWT_SECRET",
      "ADMIN_EMAIL",
      "ADMIN_PASSWORD",
    ];
    const missing: string[] = [];
    for (const key of required) {
      try {
        this.getRequiredString(key);
      } catch {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`,
      );
    }
  }
}
