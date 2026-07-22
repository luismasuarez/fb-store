# Implementation Plan: Pipeline Classify-Extract Refactor

**Branch**: `001-pipeline-classify-extract` | **Date**: 2026-07-21 | **Spec**: specs/001-pipeline-classify-extract/spec.md

**Input**: Feature specification from `specs/001-pipeline-classify-extract/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Refactor the AI processor from a single-stage `extract()` call into a multi-stage
pipeline: Cleaner → Classifier → Extractor → Transformer → Storer. Add a
Classifier stage using a cheap LLM to reject non-real-estate posts before
expensive extraction. Introduce three listing statuses (active/review/rejected)
with configurable per-group confidence thresholds. Implement ExtractorRegistry
so new content domains can be added without modifying pipeline code.

## Technical Context

**Language/Version**: TypeScript 6.x with strict mode (`strict: true`)

**Primary Dependencies**:
- Hono (HTTP server, scraper API)
- Playwright (headless Chrome scraping)
- Prisma 7 + PostgreSQL (database)
- OpenRouter SDK (AI provider)
- Zod (validation — already used in schemas.ts)
- vitest (testing framework, already configured)

**Storage**: PostgreSQL via Prisma ORM (existing schema in
`packages/scraper/prisma/schema.prisma`)

**Testing**: vitest (already configured in `packages/scraper/package.json`).
Test types: contract (API boundaries), integration (pipeline stages), unit
(isolated logic like mapper, cleaner).

**Target Platform**: Linux server (headless)

**Project Type**: Web service (scraper API + AI processor) + Dashboard
(Astro/React frontend)

**Performance Goals**:
- Classifier should process a post in under 3 seconds (cheap model)
- Combined classify + extract should not exceed 15 seconds per post
- AI processing cost target: classifier ≤30%, extractor ≥70% of total

**Constraints**:
- Must preserve backward compatibility with existing listings
- Existing "sold" status must remain for manual use
- No changes to the scraping stage (Playwright extraction)
- Must work within existing OpenRouter API limits

**Scale/Scope**: Single-user tool initially, processing ~30-100 posts per
scrape cycle across ~5-10 Facebook groups

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

MUST verify compliance against all principles in `.specify/memory/constitution.md`:

### Pre-Design (Phase 0 gate)

- [x] **SDD (I)**: Spec exists and is approved (specs/001-pipeline-classify-extract/spec.md).
  Feature has 3 user stories, each independently testable with Given/When/Then.
- [x] **TDD (II)**: Tests MUST be written and fail before implementation.
  Contract tests for each pipeline stage, integration test for the full flow,
  unit tests for classifier/extractor modules. (Verified: 16 ai-processor tests,
  62 scraper tests covering classifier, router, registry, review API, and extractor
  selection — all pass.)
- [x] **SOLID (III)**: Design applies SRP (separate Classifier/Extractor stages),
  OCP (new domains via Registry, no pipeline modification), ISP (small focused
  interfaces per stage), DIP (depends on ContentExtractor abstraction).
- [x] **DRY & Facade (IV)**: ExtractorRegistry is the single entry point for
  all extractors. Shared types (ClassificationResult, ContentExtractor contract)
  live in @fb-store/shared.
- [x] **Pipeline (V)**: This feature IS the pipeline refactor — replaces a
  monolithic extract() with [Classify] → [Extract] → [Transform] → [Store].
  Each stage is independently testable with mocked I/O.

### Post-Design (Phase 1 re-check)

- [x] **SDD (I)**: Research completed, data model defined, contracts documented.
- [x] **SOLID (III)**: Verified: Classifier and Extractor are separate modules
  communicating through Contracts. ExtractorRegistry enables OCP. The `@fb-store/shared`
  Facade provides the ContentExtractor interface — pipeline code never imports
  extractor implementations directly.
- [x] **DRY & IV)**: Verified: all shared types (ClassificationResult, ContentExtractor)
  in shared package. Registry is single Facade for all extractors.
- [x] **Pipeline (V)**: Verified: Classify → Extract → Transform → Store stages
  are independent, each with its own Zod schema contract. No stage shares state
  with another.
- [x] **Complexity**: No violations. Design is simpler than current monolithic
  approach because each stage has a clear, bounded responsibility.

## Project Structure

### Documentation (this feature)

```text
specs/001-pipeline-classify-extract/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (not created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/
├── shared/src/
│   └── ai/
│       ├── types.ts              # + ClassificationResult, ContentExtractor interface
│       ├── registry.ts           # NEW: ExtractorRegistry + system prompts
│       ├── extractor.ts          # MODIFY: facade delegates to registry
│       └── openrouter.ts         # keep: provider impl unchanged
├── ai-processor/src/
│   ├── index.ts                  # MODIFY: processPost → router pipeline
│   ├── cleaner.ts                # keep: existing
│   ├── classifier.ts             # NEW: Classifier stage
│   ├── extractors/
│   │   └── inmuebles.ts          # NEW: real estate extractor (moved from mapper)
│   ├── mapper.ts                 # REMOVE: absorbed into extractors/inmuebles.ts
│   └── db.ts                     # MODIFY: add review/rejected actions
├── scraper/
│   ├── prisma/schema.prisma      # MODIFY: +Group.purpose, +Group.rejectThreshold, +Group.classifyThreshold
│   └── src/routes/
│       ├── listings.ts           # MODIFY: status filter defaults, review endpoint
│       └── groups.ts             # MODIFY: CRUD for new Group fields
apps/dashboard/src/
├── components/listings/
│   ├── ListingTable.tsx          # MODIFY: add status filter + review tab
│   └── ListingDetailPage.tsx     # MODIFY: show new statuses, approve/reject actions
└── pages/
    └── listings.astro            # MODIFY: routing for review view
```

**Structure Decision**: Monorepo with 4 packages (shared, ai-processor, scraper,
dashboard). The classifier and extractor live as separate modules within
`ai-processor/src/` since they are pipeline stages, not shared libraries. The
`ContentExtractor` interface and `ExtractorRegistry` go into `shared/src/ai/`
because they must be accessible to both the processor and any future agents.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |
