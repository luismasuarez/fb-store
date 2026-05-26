import type { AIProvider, StructuredPropertyListing } from "./provider";
import { PROMPT_SYSTEM } from "./registry";

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;
const TIMEOUT_MS = 30000;

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async extract(rawText: string, _imageUrls?: string[]): Promise<StructuredPropertyListing> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }

      try {
        return await this._call(rawText);
      } catch (err: any) {
        lastError = err;
        if (err?.message?.startsWith("OpenRouter 4")) {
          throw err;
        }
      }
    }

    throw lastError;
  }

  private async _call(rawText: string): Promise<StructuredPropertyListing> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://fbstore.app",
          "X-OpenRouter-Title": "FB Store",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: PROMPT_SYSTEM },
            {
              role: "user",
              content: [
                { type: "text", text: rawText.substring(0, 8000) },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${body}`);
      }

      const data: any = await res.json();
      const content: string | undefined = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("OpenRouter: empty response");
      }

      return JSON.parse(content) as StructuredPropertyListing;
    } finally {
      clearTimeout(timer);
    }
  }
}
