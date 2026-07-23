FROM node:22-slim AS base
RUN corepack enable && \
    groupadd -r fbstore && \
    useradd -r -g fbstore -d /app fbstore
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:/app/node_modules/.bin:$PATH
WORKDIR /app

FROM base AS chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    && rm -rf /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

FROM chromium AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/scraper/package.json packages/scraper/package.json
COPY packages/scraper/prisma packages/scraper/prisma
COPY packages/ai-processor/package.json packages/ai-processor/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @fb-store/scraper db:generate && \
    pnpm --filter @fb-store/scraper build

FROM chromium AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/scraper/dist ./packages/scraper/dist
COPY --from=builder /app/packages/scraper/src/static ./packages/scraper/src/static
COPY --from=builder /app/packages/scraper/prisma ./packages/scraper/prisma
COPY --from=builder /app/packages/ai-processor ./packages/ai-processor
COPY --from=builder /app/packages/shared ./packages/shared

RUN mkdir -p /app/profiles && chown -R fbstore:fbstore /app
USER fbstore
EXPOSE 3001
VOLUME /app/profiles
CMD ["tsx", "packages/scraper/dist/server.js"]
