import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
    setupFiles: ["./vitest.setup.ts"],
    deps: {
      inline: ["@nestjs/common", "@nestjs/core", "@nestjs/testing", "@nestjs/config", "@nestjs/bullmq"],
    },
  },
});
