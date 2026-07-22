<!--
  Sync Impact Report
  ==================
  Version change: 0.0.0 → 1.0.0
  Modified principles:
    - [PRINCIPLE_1_NAME] → I. Specification-Driven Development (SDD)
    - [PRINCIPLE_2_NAME] → II. Test-First Discipline (TDD — NON-NEGOTIABLE)
    - [PRINCIPLE_3_NAME] → III. SOLID Principles
    - [PRINCIPLE_4_NAME] → IV. DRY & Facade Pattern
    - [PRINCIPLE_5_NAME] → V. Pipeline Architecture (Pluggable Stages)
  Added sections:
    - Technology Stack & Constraints (Section 2)
    - Development Workflow (Section 3)
    - Governance section filled with concrete rules
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/constitution-template.md → ✅ aligned (stays generic as base template)
    - .specify/templates/plan-template.md → ✅ updated Constitution Check gate references new principles
    - .specify/templates/spec-template.md → ✅ aligned (no changes needed)
    - .specify/templates/tasks-template.md → ✅ updated Format section adds [Stage] dimension
    - .specify/templates/checklist-template.md → ✅ aligned (no changes needed)
  Follow-up TODOs: None
-->

# fb-store Constitution

## Core Principles

### I. Specification-Driven Development (SDD)

Every feature MUST start with a specification. The mandatory workflow is:
spec.md → plan.md + research.md → tasks.md → implementation.

- **spec.md**: User stories with Given/When/Then acceptance scenarios,
  prioritized (P1/P2/P3), each independently testable as an MVP slice.
- **plan.md**: Technical approach, architecture decision, Constitution Check
  gate, complexity justification for any violation.
- **tasks.md**: Tasks grouped by user story, tests written before
  implementation, phases clearly delineated.
- No code MAY be written for a feature until its spec is approved.

Rationale: This project has multiple interconnected packages (scraper,
ai-processor, shared, dashboard). SDD prevents waste, keeps scope
bounded, and ensures every change has traceable intent.

### II. Test-First Discipline (TDD — NON-NEGOTIABLE)

Red-Green-Refactor cycle MUST be followed for every implementation task:

1. **Red**: Write a failing test that expresses the desired behavior.
2. **Green**: Write the minimal implementation to make the test pass.
3. **Refactor**: Clean up without changing behavior; all tests MUST
   remain green.

Rules:
- Tests MUST be committed BEFORE implementation code in the same task.
- Contract tests cover API boundaries (e.g., listing endpoint I/O,
  extractor output shape).
- Integration tests cover cross-stage pipelines (e.g., scrape → save →
  process → list).
- Unit tests cover isolated logic (e.g., mapper, sanitizer, cleaner).
- Any code change that breaks existing tests MUST be justified in the
  plan's Constitution Check section.

Rationale: The data pipeline has many edge cases (Facebook DOM changes,
malformed posts, AI parse failures). TDD gives a safety net for the
fragile integration points.

### III. SOLID Principles

When using classes and OOP patterns, ALL five SOLID principles apply:

- **S**ingle Responsibility: A class/module has one reason to change.
  The scraper does not do AI extraction; the AI processor does not
  know about Facebook's DOM structure.
- **O**pen/Closed: Modules are open for extension (new extractors,
  new storage backends) but closed for modification.
- **L**iskov Substitution: Derived extractors or processors MUST be
  substitutable for their base types without breaking the pipeline.
- **I**nterface Segregation: Small, focused interfaces over large,
  general ones. `ContentExtractor` has `classify()` and `extract()`,
  not a monolithic `processEverything()`.
- **D**ependency Inversion: Depend on abstractions, not concretions.
  The pipeline depends on `AIProvider` interface, not `OpenRouter`
  directly.

In functional code (pure functions, services without classes), apply
the spirit of SRP and OCP: one responsibility per function, extensible
via composition (higher-order functions, strategy injection).

### IV. DRY & Facade Pattern

Every module, library, or external dependency MUST have a single entry
point (Facade). Never import from internal paths, submodules, or
third-party libs directly — always go through the Facade.

Examples:
- `<Icon>` component wrapping any icon library.
- `api/client` wrapping HTTP calls.
- `index.ts` barrel export per feature module.
- `Extractor` class wrapping AI provider selection.

When the underlying implementation changes, only the Facade gets
modified — consumers stay untouched.

DRY rules:
- Duplicated logic MUST be extracted into shared functions, hooks,
  utilities, or components.
- Exception: small inline duplication is acceptable if extracting
  would reduce readability without measurable benefit.
- The `@fb-store/shared` package exists specifically for shared types,
  schemas, and provider abstractions. Use it.

### V. Pipeline Architecture (Pluggable Stages)

The data pipeline must be composed of independent, pluggable stages.
Each stage has exactly one responsibility:

```
[Scrape] → [Classify] → [Extract] → [Transform] → [Store]
```

Constraints:
- Each stage MUST be independently testable with mocked inputs/outputs.
- Each stage MUST declare its input and output types explicitly (Zod
  schemas or TypeScript interfaces).
- Stages communicate through well-defined data contracts; they do NOT
  share internal state.
- A stage MAY be replaced entirely without modifying adjacent stages
  (Open/Closed applied at the pipeline level).
- New content domains (e.g., cars, electronics) are added by creating
  new stage implementations, not by modifying existing ones.

Rationale: The fb-store project currently has a single rigid pipeline
that treats everything as real estate. Pipeline Architecture allows
adding new content types (cars, jobs, electronics) without refactoring
existing code — each becomes a separate pipeline with its own
Classifier, Extractor, and Transform.

## Technology Stack & Constraints

### Mandated Stack
- **Runtime**: Node.js >= 22.13 (per package.json engines).
- **Language**: TypeScript 6.x (strict mode required: `strict: true` in
  tsconfig, no `any` unless explicitly justified).
- **Monorepo**: pnpm workspaces + Turborepo for task orchestration.
- **Database**: PostgreSQL (via Prisma ORM).
- **Scraping**: Playwright (headless Chrome via persistent contexts).
- **AI Provider**: OpenRouter (pluggable via `AIProvider` interface —
  other providers can be added without modifying pipeline code).
- **HTTP Server**: Hono (lightweight, Fastify-compatible, used by
  scraper API).
- **Dashboard**: Astro + React (apps/dashboard).
- **Validation**: Zod schemas for all external boundaries (API
  requests, AI responses, DB models).

### Constraints
- No direct dependency on third-party icon libraries or UI kits
  without a Facade wrapper.
- AI prompts MUST be version-controlled in
  `packages/shared/src/ai/registry.ts` alongside their types.
- Browser profiles (Chrome user data) MUST NOT be committed to the
  repository — they live in `profiles/` (gitignored).
- API keys (OpenRouter, database) MUST be in environment variables,
  never in source code.
- The `.env.example` file MUST be kept in sync with actual environment
  variables used.

## Development Workflow

### Feature Lifecycle
1. **Specify**: Create spec.md with user stories and acceptance criteria.
2. **Plan**: Create plan.md with technical approach and Constitution
   Check gate — MUST pass before any implementation.
3. **Branch**: Create feature branch via speckit-git-feature.
4. **Implement**: Follow tasks.md — tests first, then code.
5. **Verify**: Run type-check, lint, and test suite. All gates MUST pass.
6. **Commit**: Each logical unit gets a commit. No monolithic commits.
7. **Review**: Code review verifies constitution compliance.

### Quality Gates (MUST pass before merge)
- `pnpm typecheck` — zero type errors.
- `pnpm lint` — zero lint errors, warnings reviewed.
- `pnpm test` — all tests pass. New features MUST include tests.
- Constitution Check from plan.md — complexity is justified, no
  principle violations.

### Commit Convention
- Format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `spec`
- Scope: the affected package or module (e.g., `scraper`, `ai-processor`,
  `dashboard`, `shared`, `constitution`)
- Examples:
  - `feat(scraper): add multi-image carousel extraction`
  - `test(ai-processor): add classifier stage contract tests`
  - `docs(constitution): amend governance to v1.0.0`

## Governance

### Amendment Procedure
1. Any proposed amendment MUST be documented in a spec (spec.md).
2. The amendment MUST include a migration section if it changes
   existing principles or rules.
3. Approval requires consensus from all active contributors.
4. After approval, the constitution is updated and version is bumped.

### Versioning Policy
- **MAJOR**: Backward-incompatible governance changes, principle
  removals or redefinitions.
- **MINOR**: New principle or section added, materially expanded
  guidance.
- **PATCH**: Clarifications, wording refinements, typo fixes.

### Compliance
- All specs MUST include a Constitution Check section.
- All plans MUST verify compliance before Phase 0 research and after
  Phase 1 design.
- Complexity must be justified in the Complexity Tracking table of
  the plan when it violates principles (e.g., a 4th monorepo package
  needs justification).
- The constitution file itself is subject to review like any code
  change.

**Version**: 1.0.0 | **Ratified**: 2026-05-25 | **Last Amended**: 2026-07-21
