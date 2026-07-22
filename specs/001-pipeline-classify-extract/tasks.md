---

description: "Task list for Pipeline Classify-Extract Refactor"

---

# Tasks: Pipeline Classify-Extract Refactor

**Input**: Design documents from `specs/001-pipeline-classify-extract/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per Constitution Principle II (TDD — NON-NEGOTIABLE).
Tests MUST be written and fail before implementation of each component.

**Organization**: Tasks grouped by user story for independent implementation
and testing. Stage labels per Constitution Principle V (Pipeline Architecture):
[Scrape], [Classify], [Extract], [Transform], [Store]

## Format: `[ID] [P?] [Story] [Stage?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- **[Stage]**: Pipeline stage per constitution (Classify, Extract, Store, etc.)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prisma schema migration, shared types, and base infrastructure

- [ ] T001 [P] Add Group model fields (purpose, rejectThreshold, classifyThreshold)
      in packages/scraper/prisma/schema.prisma
- [ ] T002 [P] Generate Prisma migration for new Group fields by running
      pnpm db:migrate from packages/scraper
- [ ] T003 [P] Add ClassificationResult interface to
      packages/shared/src/ai/types.ts
- [ ] T004 [P] Add ContentExtractor interface to
      packages/shared/src/ai/types.ts
- [ ] T005 [P] Create ExtractorRegistry class in
      packages/shared/src/ai/registry.ts
- [ ] T006 [P] Update shared barrel exports in packages/shared/src/index.ts
      to export new types and registry

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Classifier module, processor pipeline changes, DB operations.
MUST complete before any user story.

- [ ] T007 [Classify] Create Classifier stage in
      packages/ai-processor/src/classifier.ts — receives cleaned post text,
      calls lightweight LLM (gemini-flash via OpenRouter), returns
      ClassificationResult. Duplicate the Extractor pattern from
      packages/shared/src/ai/extractor.ts as reference.
- [ ] T008 [Transform] Add status routing logic: based on ClassificationResult
      confidence + group thresholds, determine listing status (active/review/
      rejected). Implement in packages/ai-processor/src/classifier.ts or a
      dedicated router module at packages/ai-processor/src/router.ts.
- [ ] T009 [Store] Add approve/reject/restore DB functions in
      packages/ai-processor/src/db.ts: approveListing(id), rejectListing(id),
      restoreListing(id), getReviewQueue()
- [ ] T010 Add migration script for existing "sold" listings in
      packages/ai-processor/src/migrate.ts — old sold + "otro" → rejected,
      old sold + non-otro → review
- [ ] T011 [Transform] Refactor processPost() in
      packages/ai-processor/src/index.ts to route through:
      Cleaner → Classifier → (if inmuebles) Extractor → Transformer → Storer.
      If classified as rejected, skip extraction and store directly.

**Checkpoint**: Foundation ready — classifier runs, pipeline routes correctly,
DB functions exist.

---

## Phase 3: User Story 1 — Classifier Rejects Non-Real-Estate (Priority: P1) 🎯 MVP

**Goal**: Non-real-estate posts (water tanks, electronics, etc.) are
automatically rejected without attempting property extraction.

**Independent Test**: Configure group with mixed content, run scrape + process,
verify water-tank posts have status "rejected" and house posts have status
"active" in the listings API.

### Tests for User Story 1

- [ ] T012 [P] [US1] [Classify] Contract test for Classifier stage in
      packages/ai-processor/src/__tests__/classifier.test.ts — mock LLM
      response, verify ClassificationResult shape and confidence mapping
- [ ] T013 [P] [US1] [Transform] Unit test for status routing logic in
      packages/ai-processor/src/__tests__/router.test.ts — verify
      threshold-to-status mapping for all confidence ranges
- [ ] T014 [P] [US1] [Extract] Unit test for extractor selection in
      packages/ai-processor/src/__tests__/extractor-selector.test.ts — verify
      that rejected posts skip the extractor entirely

### Implementation for User Story 1

- [ ] T015 [P] [US1] [Classify] Wire classifier prompt in
      packages/ai-processor/src/classifier.ts — short system prompt that asks
      "is this real estate?" with contentType and confidence output
- [ ] T016 [P] [US1] [Transform] Implement status router logic — map
      ClassificationResult to listing status based on group thresholds
- [ ] T017 [P] [US1] [Transform] Integrate processPost() routing in
      packages/ai-processor/src/index.ts — classify → route → extract or skip
- [ ] T018 [US1] [Store] Add logging in processPost() per FR-019: log post ID,
      classification result, confidence, processing time

**Checkpoint**: US1 complete — non-real-estate posts rejected, houses extracted,
both with correct statuses.

---

## Phase 4: User Story 2 — Review Queue (Priority: P2)

**Goal**: Borderline-confidence listings appear in a review queue where the
user can approve or reject them.

**Independent Test**: Process a post with ambiguous text, verify it has status
"review". Use the API to approve it, verify status changes to "active".

### Tests for User Story 2

- [ ] T019 [P] [US2] [Store] Contract test for review API endpoints in
      packages/scraper/src/__tests__/listings-review.test.ts — test approve,
      reject, restore, and getReviewQueue
- [ ] T020 [P] [US2] [Store] Integration test for full review flow in
      packages/scraper/src/__tests__/listings-review-flow.test.ts —
      create listing → set to review → approve → verify active

### Implementation for User Story 2

- [ ] T021 [P] [US2] [Store] Add GET /api/v1/listings/review endpoint in
      packages/scraper/src/routes/listings.ts — returns review-queued listings
      ordered by scrapedAt ASC
- [ ] T022 [P] [US2] [Store] Add POST /api/v1/listings/:id/approve endpoint in
      packages/scraper/src/routes/listings.ts — changes status to active
- [ ] T023 [P] [US2] [Store] Add POST /api/v1/listings/:id/reject endpoint in
      packages/scraper/src/routes/listings.ts — changes status to rejected
- [ ] T024 [P] [US2] [Store] Add POST /api/v1/listings/:id/restore endpoint in
      packages/scraper/src/routes/listings.ts — changes status from rejected
      to review
- [ ] T025 [P] [US2] [Store] Update status filter default in
      packages/scraper/src/routes/listings.ts — default to "active" only,
      support comma-separated status values and status_ne
- [ ] T026 [P] [US2] [Store] Add "Review" tab view in
      apps/dashboard/src/components/listings/ListingTable.tsx — shows review
      items with approve/reject buttons
- [ ] T027 [P] [US2] [Store] Add approve/reject UI in
      apps/dashboard/src/components/listings/ListingDetailPage.tsx — buttons
      for each listing in detail view
- [ ] T028 [P] [US2] [Store] Add "Rejected" filter tab in
      apps/dashboard/src/components/listings/ListingTable.tsx — shows rejected
      items with restore option
- [ ] T029 [US2] Add review queue page routing in
      apps/dashboard/src/pages/listings.astro — support ?status=review parameter
      and review tab navigation

**Checkpoint**: US2 complete — review queue exists, approve/reject works,
dashboard shows review and rejected tabs.

---

## Phase 5: User Story 3 — Content-Type Routing via Registry (Priority: P3)

**Goal**: ExtractorRegistry enables adding new content domains without pipeline
code changes. Group purpose field routes to the correct extractor.

**Independent Test**: Register a mock vehicle extractor, configure a test group
with purpose "vehiculos", verify the pipeline routes posts through the vehicle
extractor. (Mock LLM responses, no real Facebook groups.)

### Tests for User Story 3

- [ ] T030 [P] [US3] [Classify] Contract test for ExtractorRegistry in
      packages/shared/src/__tests__/extractor-registry.test.ts — register,
      get, getAll, and error on unknown type
- [ ] T031 [P] [US3] [Classify] Integration test for purpose-based routing in
      packages/ai-processor/src/__tests__/purpose-routing.test.ts — configure
      groups with different purposes, verify correct extractor is selected
- [ ] T032 [P] [US3] [Store] Contract test for Group CRUD with new fields in
      packages/scraper/src/__tests__/groups-api.test.ts — test purpose,
      rejectThreshold, classifyThreshold in create/update/get

### Implementation for User Story 3

- [ ] T033 [P] [US3] [Classify] Refactor Extractor to use Registry in
      packages/shared/src/ai/extractor.ts — Extractor.extract() now looks up
      the ContentExtractor from ExtractorRegistry based on group purpose
- [ ] T034 [P] [US3] [Classify] Extract the real estate extraction logic into
      a self-contained InmueblesExtractor class in
      packages/ai-processor/src/extractors/inmuebles.ts — with own prompt,
      Zod schema, and confidence logic
- [ ] T035 [P] [US3] [Classify] Register InmueblesExtractor with
      ExtractorRegistry in packages/ai-processor/src/extractors/inmuebles.ts
      (at module import time)
- [ ] T036 [US3] [Store] Update Group CRUD routes in
      packages/scraper/src/routes/groups.ts — add purpose, rejectThreshold,
      classifyThreshold to create/update/response schemas and handlers
- [ ] T037 [US3] [Classify] Default purpose routing in
      packages/ai-processor/src/classifier.ts — when group purpose is null,
      use general classifier that routes to most likely extractor or marks
      for review
- [ ] T038 [P] [US3] Remove old mapper.ts in
      packages/ai-processor/src/mapper.ts — its logic is absorbed into
      InmueblesExtractor

**Checkpoint**: US3 complete — Registry works, InmueblesExtractor is
self-contained, Group purpose routes correctly, old mapper removed.

---

## Phase 6: Migration, Verification & Polish

**Purpose**: Run migration for existing data, verify end-to-end, clean up

- [ ] T039 Run the existing "sold" listing migration script in
      packages/ai-processor/src/migrate.ts — execute once against production DB
- [ ] T040 Run full test suite with pnpm test — all tests must pass
- [ ] T041 Run type-check with pnpm typecheck — zero errors
- [ ] T042 Run lint with pnpm lint — zero errors
- [ ] T043 Execute quickstart validation scenarios from
      specs/001-pipeline-classify-extract/quickstart.md — all 7 scenarios pass
- [ ] T044 [P] Documentation: update README or any relevant docs to reflect
      the new pipeline architecture and status model

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 complete — BLOCKS all user stories
- **Phase 3 (US1 — P1)**: Depends on Phase 2 — no dependencies on US2/US3
- **Phase 4 (US2 — P2)**: Depends on Phase 2 — no dependencies on US1/US3
- **Phase 5 (US3 — P3)**: Depends on Phase 2 — no dependencies on US1/US2
- **Phase 6 (Polish)**: Depends on US1 completion (can run alongside US2/US3)

### User Story Dependencies

- **US1 (P1)**: Independent of US2 and US3 — can be built and tested alone
- **US2 (P2)**: Independent of US1 and US3 — review API does not depend on
  classifier logic, only on the status field
- **US3 (P3)**: Independent of US1 and US2 — registry + purpose routing does
  not depend on classifier thresholds or review queue

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/schemas before services
- Services before endpoints/UI
- Core logic before integration

### Parallel Opportunities

- **Phase 1**: All tasks marked [P] can run in parallel (T001-T006)
- **Phase 2**: T007-T011 are sequential (pipeline must be built top-down)
- **Phase 3**: T012-T014 (tests) in parallel, then T015-T018 sequentially
- **Phase 4**: T019-T020 (tests) in parallel, T021-T028 in parallel
  (API endpoints + dashboard components are independent)
- **Phase 5**: T030-T032 (tests) in parallel, T033-T038 mostly parallel
- Since US1/US2/US3 have no cross-dependencies, they can be implemented
  in parallel if team capacity allows

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup — schema migration, shared types, registry
2. Complete Phase 2: Foundational — classifier, pipeline routing, DB functions
3. Complete Phase 3: User Story 1 — classifier rejects non-real-estate
4. **STOP and VALIDATE**: Test US1 independently via API
5. Deploy/demo if ready — this alone solves the water-tank problem

### Incremental Delivery

1. Phase 1 + 2 → Pipeline foundation ready (classify + route works)
2. Add US1 → Non-real-estate rejected ✅ (MVP!)
3. Add US2 → Review queue + approve/reject
4. Add US3 → Registry + multi-purpose routing
5. US3 can be deferred if not yet needed — US1 + US2 deliver immediate value

### Parallel Team Strategy

With multiple developers:

1. Complete Phase 1 + 2 together
2. Once Foundation is done:
   - Developer A: US1 (classifier + pipeline integration)
   - Developer B: US2 (review API + dashboard)
   - Developer C: US3 (registry + extractor refactor)
3. All three stories are independent — no merge conflicts on shared code

---

## Notes

- [P] tasks = different files, no dependencies
- [Stage] label maps to pipeline stage per Constitution Principle V
- Each user story is independently completable and testable
- TDD: ALL tests marked above MUST be written and FAIL before their
  corresponding implementation is started
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US2 dashboard tasks require basic React/Astro knowledge of existing
  ListingTable and ListingDetailPage patterns
