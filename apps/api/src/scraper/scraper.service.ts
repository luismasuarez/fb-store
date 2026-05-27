import { Injectable, Logger } from "@nestjs/common";
import { fork } from "child_process";
import { resolve } from "path";

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  async run(): Promise<{ success: boolean; output: string }> {
    return new Promise((resolvePromise) => {
      const scriptPath = resolve(
        __dirname,
        "../../../../packages/scraper/dist/index.js",
      );

      const proc = fork(scriptPath, [], {
        cwd: resolve(__dirname, "../../../.."),
        env: {
          ...process.env,
          NODE_ENV: "production",
        },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });

      let output = "";

      proc.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        output += text;
        this.logger.log(`[scraper] ${text.trim()}`);
      });

      proc.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        output += text;
        this.logger.error(`[scraper] ${text.trim()}`);
      });

      proc.on("close", (code) => {
        this.logger.log(`Scraper exited with code ${code}`);
        resolvePromise({
          success: code === 0,
          output: output.trim(),
        });
      });

      proc.on("error", (err) => {
        this.logger.error(`Failed to start scraper: ${err.message}`);
        resolvePromise({
          success: false,
          output: err.message,
        });
      });
    });
  }
}
