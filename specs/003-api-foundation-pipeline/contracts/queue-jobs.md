# Queue Job Contracts: Spec 001

> Phase 1 output — BullMQ job data contracts for scraper and AI-processor queues

## Queue: `scrape`

### Job: `scrape-group`

**Produced by**: POST /api/scrape controller, SchedulerService (repeatable job)
**Consumed by**: Scraper Worker (packages/scraper)

**Job Data**:
```typescript
interface ScrapeJobData {
  groupId?: string;   // Specific group to scrape. Omit to scrape all active
  maxPosts?: number;  // Max posts per group. Omit for group default
}
```

**Job Options**:
```typescript
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,   // Keep last 100 completed
  removeOnFail: 50,        // Keep last 50 failed
}
```

**Expected Return Value** (from worker `process()`):
```typescript
interface ScrapeJobResult {
  groupId: string;
  postsFound: number;
  postsNew: number;
  durationMs: number;
}
```

**Side Effects**:
- Saves RawPost records to database
- Saves ScrapeLog record with metrics
- If `postsNew > 0`: enqueues `ai-process` queue with job `process-pending` (no specific IDs — processes all pending)

### Job: `scrape-all` (repeatable)

**Produced by**: SchedulerService `upsertJobScheduler()`
**Same data/processing** as `scrape-group` but with no specific groupId (process all active groups)

---

## Queue: `ai-process`

### Job: `process-pending`

**Produced by**: Scraper Worker (when new posts found), POST /api/ai-process controller
**Consumed by**: AI Processor Worker (packages/ai-processor)

**Job Data**:
```typescript
interface AiProcessJobData {
  rawPostIds?: string[];  // Specific posts to process. Omit to process all pending
}
```

**Job Options**:
```typescript
{
  attempts: 2,
  backoff: { type: 'fixed', delay: 30000 },  // 30s retry for rate limits
  timeout: 120000,  // 2 min timeout (AI calls can be slow)
}
```

**Expected Return Value**:
```typescript
interface AiProcessJobResult {
  processed: number;
  created: number;
  errors: number;
}
```

**Side Effects**:
- Reads RawPost records with `processed = false`
- Calls AI extractor on each post's `textContent`
- Creates/updates Listing records
- Marks RawPost as `processed = true` on success
- On failure: leaves RawPost as `processed = false` for retry

---

## Queue Configuration

### Connection

Both queues share the same Redis connection specified by `REDIS_URL` env var.

```typescript
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  // password: process.env.REDIS_PASSWORD,  // if needed
};
```

### Prefix

BullMQ prefix: `{fb-store}` (configurable via env var `BULL_PREFIX`)

### Queue Names

| Queue Name | Purpose | Consumers |
|------------|---------|-----------|
| `scrape` | Facebook scraping jobs | Scraper Worker (standalone) |
| `ai-process` | AI processing jobs | AI Processor Worker (standalone) |
