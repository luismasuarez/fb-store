# Quickstart: Pipeline Classify-Extract Refactor

## Prerequisites

- Node.js >= 22.13, pnpm installed
- PostgreSQL running with `DATABASE_URL` set
- OpenRouter API key in `.env` or `ai-config.json`
- Facebook profile with active session in `profiles/`

## Setup

```bash
# Install dependencies
pnpm install

# Generate Prisma client (after schema changes)
pnpm db:generate

# Apply database migrations
pnpm db:migrate
```

## Validation Scenarios

### Scenario 1: Classifier rejects non-real-estate

```bash
# Use the AI test endpoint with a water tank post
curl -X POST http://localhost:3000/api/v1/ai/test \
  -H "Content-Type: application/json" \
  -d '{"text": "Vendo tanque de agua de 500 litros, nuevo, $5000 CUP, recogida en Centro Habana"}'
```

**Expected**: Classifier returns `contentType: "rechazado"`, confidence > 0.5.
No extractor called. Post stored as listing with status "rejected".

### Scenario 2: Classifier passes real estate to extractor

```bash
curl -X POST http://localhost:3000/api/v1/ai/test \
  -H "Content-Type: application/json" \
  -d '{"text": "Vendo casa en Playa, 3 cuartos, 2 baños, sala comedor, cocina, patio, $25000 USD, contacto: 5555-1234"}'
```

**Expected**: Classifier returns `contentType: "inmuebles"`, confidence > 0.5.
Extractor runs and returns full StructuredPropertyListing. Listing stored as
status "active".

### Scenario 3: Borderline confidence goes to review

```bash
curl -X POST http://localhost:3000/api/v1/ai/test \
  -H "Content-Type: application/json" \
  -d '{"text": "Vendo casa, informacion al privado"}'
```

**Expected**: Classifier returns low confidence (0.2-0.5). Listing created
with status "review". Visible at `GET /api/v1/listings/review`.

### Scenario 4: Review queue in dashboard

```bash
# Check review queue
curl http://localhost:3000/api/v1/listings/review
```

**Expected**: Returns all listings with status "review", ordered oldest first.

### Scenario 5: Approve from review

```bash
curl -X POST http://localhost:3000/api/v1/listings/<review-listing-id>/approve
```

**Expected**: Listing status changes to "active". Now visible in main listings.

### Scenario 6: Reject from review

```bash
curl -X POST http://localhost:3000/api/v1/listings/<review-listing-id>/reject
```

**Expected**: Listing status changes to "rejected". Hidden from main listings.
Visible when querying `?status=rejected`.

### Scenario 7: Full pipeline integration test

Larger test that runs the actual AI processor against pending RawPost records:

```bash
# Run the batch processor manually
pnpm --filter @fb-store/scraper ai:process  # or the appropriate command

# Verify results
curl "http://localhost:3000/api/v1/listings?limit=100"
```

**Expected**: All processed posts have appropriate statuses. No non-real-estate
posts appear with status "active".

## Test Suite

```bash
# Run all tests
pnpm test

# Run specific test files
pnpm vitest run packages/ai-processor/src/__tests__/classifier.test.ts
pnpm vitest run packages/ai-processor/src/__tests__/extractor-registry.test.ts
pnpm vitest run packages/scraper/src/__tests__/listings-api.test.ts
```

## Verification Checklist

- [ ] Classifier returns correct classification for 10 known property posts
- [ ] Classifier correctly rejects 10 known non-property posts
- [ ] Review queue shows borderline-confidence posts
- [ ] Approve action moves listing to active
- [ ] Reject action moves listing to rejected
- [ ] Group purpose field routes to correct extractor
- [ ] All existing tests pass
