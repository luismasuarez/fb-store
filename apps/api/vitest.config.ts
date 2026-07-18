import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.spec.ts"],
    exclude: ["node_modules", "dist", "test"],
    setupFiles: ["./vitest.setup.ts"],
    deps: {
      inline: ["@nestjs/common", "@nestjs/core", "@nestjs/testing", "@nestjs/config", "@nestjs/bullmq"],
    },
  },
});
