# Research: Fundación API + Pipeline Automático

> Phase 0 output — all technical decisions resolved

## 1. BullMQ Worker Pattern with @nestjs/bullmq

**Decision**: Use `@nestjs/bullmq` decorators (`@Processor`, `WorkerHost`, `@OnWorkerEvent`) for API-side job producers. For scraper and AI-processor packages (standalone Node.js processes), use raw BullMQ `Worker` directly.

**Rationale**: The API already has `@nestjs/bullmq` 11.0 as a dependency. For API-side consumers (scrape controller, AI-processor controller, scheduler), the NestJS decorator pattern provides clean DI integration. The scraper and AI-processor are standalone Node.js processes running as Docker services — they don't run inside NestJS, so they use raw BullMQ `Worker` directly (no decorators needed). Both share the same Redis connection.

**Architecture**:
- API (NestJS): `BullModule.forRootAsync()` → `BullModule.registerQueue()` for `scrape` and `ai-process` queues
- Scraper (standalone): `new Worker('scrape', processor, { connection })` → on completion: `new Queue('ai-process', { connection }).add('process', data)`
- AI Processor (standalone): `new Worker('ai-process', processor, { connection })`

**Pattern**:
```typescript
// API — QueueService wrapper
@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('scrape') private scrapeQueue: Queue,
    @InjectQueue('ai-process') private aiQueue: Queue,
  ) {}

  async addScrapeJob(data: ScrapeJobData): Promise<Job> {
    return this.scrapeQueue.add('scrape-group', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = queueName === 'scrape' ? this.scrapeQueue : this.aiQueue;
    return queue.getJob(jobId);
  }
}
```

```typescript
// Scraper worker (standalone)
const worker = new Worker<ScrapeJobData>(
  'scrape',
  async (job) => {
    const posts = await scrapeGroup(job.data);
    const saved = await savePosts(posts, job.data.groupId);
    if (saved > 0) {
      await new Queue('ai-process').add('process-pending', {});
    }
    await saveScrapeLog(job.data.groupId, metrics);
    return { postsFound: posts.length, postsNew: saved };
  },
  { connection: { host: process.env.REDIS_HOST || 'localhost', port: 6379 } },
);
```

## 2. Global Exception Filter with RequestId

**Decision**: Implement a global `@Catch()` filter that catches ALL exceptions and categorizes them. Use `HttpAdapterHost` from `@nestjs/core` for platform-agnostic response handling.

**Error categories**:
| Category | HTTP Status | Trigger |
|----------|-------------|---------|
| `validation` | 400 | Zod validation errors, ParseUUIDPipe failures |
| `authorization` | 401/403 | Missing/invalid JWT, insufficient permissions |
| `rate_limit` | 429 | Rate limit exceeded |
| `business` | 409/422 | Business rule violations (duplicate, invalid state) |
| `unknown` | 500 | Unexpected errors (never expose details) |

**Pattern**:
```typescript
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();

    const { statusCode, category } = this.categorize(exception);
    const responseBody = {
      error: {
        code: category,
        message: this.safeMessage(exception),
        requestId: request.id || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, statusCode);
  }
}
```

**RequestId strategy**: NestJS + Fastify generates a `request.id` by default. The interceptor reads/forwards this as `x-request-id` header and adds logging.

## 3. Custom ZodValidationPipe vs nestjs-zod

**Decision**: Build a custom `ZodValidationPipe` instead of using `nestjs-zod` or `@anatine/zod-nestjs`.

**Rationale**: The ROADMAP architecture target specifies a custom `ZodValidationPipe` with `whitelist` + `transform`. The project already uses `@anatine/zod-nestjs` in `listings.controller.ts`, but the target architecture calls for a global custom pipe. A custom pipe avoids external dependency for validation, gives full control over error formatting, and aligns with the "Zod as single source of truth" principle from the constitution.

**Pattern**:
```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod/v4';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema = metadata.metatype as ZodSchema;
    if (!schema || !schema.safeParse) return value;

    const result = schema.safeParse(value);
    if (result.success) return result.data;

    throw new BadRequestException({
      message: 'Validation failed',
      errors: result.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
}
```

Registration via APP_PIPE:
```typescript
{
  provide: APP_PIPE,
  useClass: ZodValidationPipe,
}
```

## 4. AppConfigService — Env Validation at Startup

**Decision**: Implement `AppConfigService` that wraps NestJS `ConfigService` with typed getters and startup validation. Call `validateRequired()` in `main.ts` before `listen()`.

**Critical env vars** to validate: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (future), `OPENROUTER_API_KEY`

**Pattern**:
```typescript
@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  getString(key: string, defaultValue?: string): string {
    return this.configService.get<string>(key) ?? defaultValue;
  }

  getRequiredString(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new Error(`Missing required env var: ${key}`);
    return value;
  }

  getNumber(key: string, defaultValue?: number): number {
    const value = this.configService.get<string>(key);
    return value ? Number(value) : defaultValue;
  }

  getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = this.configService.get<string>(key);
    return value !== undefined ? value === 'true' : defaultValue;
  }
}
```

## 5. Repository Pattern for Prisma

**Decision**: Create repository classes that wrap Prisma operations. Each feature gets its own repository. Services inject repositories, never PrismaService directly.

**Pattern**:
```typescript
@Injectable()
export class ListingRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(query: ListingsQuery): Promise<{ data: Listing[]; total: number }> {
    const where = this.buildWhere(query);
    const [data, total] = await Promise.all([
      this.prisma.client.listing.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { scrapedAt: 'desc' },
      }),
      this.prisma.client.listing.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string): Promise<Listing | null> {
    return this.prisma.client.listing.findUnique({ where: { id } });
  }
}
```

## 6. Scheduler with BullMQ Repeatable Jobs

**Decision**: Use BullMQ's `QueueScheduler` (deprecated but still functional — `queue.add()` with `repeat` option) or `queue.upsertJobScheduler()`. The scheduler module registers a repeatable job on the `scrape` queue at API startup.

**Pattern**:
```typescript
@Injectable()
export class SchedulerService implements OnModuleInit {
  constructor(
    @InjectQueue('scrape') private scrapeQueue: Queue,
    @InjectQueue('ai-process') private aiQueue: Queue,
    private config: AppConfigService,
  ) {}

  async onModuleInit() {
    await this.registerSchedule();
  }

  async registerSchedule(intervalMinutes?: number, startHour?: number, endHour?: number) {
    const cron = this.buildCron(intervalMinutes ?? 240, startHour ?? 8, endHour ?? 22);
    await this.scrapeQueue.upsertJobScheduler(
      'auto-scrape',
      { pattern: cron },
      { name: 'scrape-all', data: {} },
    );
  }
}
```

## 7. Standardized API Response Envelope

**Decision**: All paginated responses use `{ data: T[], pagination: { page, limit, total, totalPages } }`. Single-resource responses use `{ data: T }`. Error responses use `{ error: { code, message, requestId, timestamp } }`. This is a breaking change for existing clients (currently return raw arrays/objects), but all consumers are internal (admin SPA).

**Pagination schema**:
```typescript
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

## 8. Docker Compose Worker Configuration

**Decision**: The scraper and AI processor already exist as separate services in `docker-compose.yml` with their own Dockerfiles. The change is to update their `command` to run the BullMQ worker entry point instead of a one-shot CLI. Keep `restart: unless-stopped` — BullMQ will idle-connect to Redis and wait for jobs.

**Workers should**:
- Connect to Redis on startup → wait for jobs
- On job received → process → return result
- On failure → log error, job is retried via BullMQ (with backoff)
- Stay alive indefinitely (unlike current CLI that exits after processing)

## Key Decisions Summary

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Raw BullMQ Worker for scraper/ai-processor packages | They are standalone processes, not NestJS-managed |
| 2 | @nestjs/bullmq decorators for API-side producers | Clean DI integration, already in dependencies |
| 3 | Custom ZodValidationPipe (not nestjs-zod) | Full control, no extra dependency, aligns with architecture target |
| 4 | Global @Catch() filter with HttpAdapterHost | Platform-agnostic, covers all exception types |
| 5 | Repository pattern per feature | Constitution requirement, testability |
| 6 | BullMQ upsertJobScheduler for scheduler | Supports CRUD operations on schedule config |
| 7 | Response envelope with `{ data, pagination }` | Consistent API contract, aligns with architecture target |
| 8 | Existing Docker services stay, only command changes | Minimal infra changes, workers already separated |
