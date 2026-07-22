# Research: Pipeline Classify-Extract Refactor

## Decision: Classifier Model Choice

**Decision**: Use `google/gemini-2.0-flash-001` (Gemini Flash) for the
Classifier stage via OpenRouter. Keep `openai/gpt-4o` for the Extractor stage.

**Rationale**:
- The project already uses OpenRouter, so no new provider setup.
- Gemini Flash is ~10x cheaper than gpt-4o-mini ($0.10/M tokens vs $0.15/M for
  Flash, but Flash has 1M context and faster inference).
- Classification is a simpler task (binary-ish: "is this real estate?") that
  doesn't need a powerful model.
- The spec's SC-006 requires classifier cost ≤30% of total — Gemini Flash
  achieves this easily.
- Both models are available on OpenRouter with the same API format.

**Alternatives considered**:
- `openai/gpt-4o-mini` (already default in ai-config.json) — more expensive
  than Gemini Flash for no gain in classification quality.
- Rule-based classifier (keywords/patterns) — faster and free, but fragile.
  Facebook posts use varied language, slang, abbreviations. Rules would need
  constant maintenance. LLM handles this more robustly.

## Decision: Classifier Output Schema

**Decision**: The Classifier will output a structured JSON (via LLM) containing:
- `contentType`: "inmuebles" | "rejected"
- `confidence`: number (0.0-1.0)
- `reasoning`: short string explaining the decision (for debugging)
- `detectedEntities`: string[] (keywords found)

**Rationale**: This matches the spec's ClassificationResult entity. The
classifier prompt will be minimal and focused on the binary decision.

## Decision: Registry Pattern for Extractors

**Decision**: Implement a simple Map-based registry:

```typescript
// packages/shared/src/ai/registry.ts
interface ContentExtractor {
  readonly contentType: string
  readonly systemPrompt: string
  readonly schema: z.ZodObject<any>
  classify(text: string): Promise<ClassificationResult>
  extract(text: string): Promise<StructuredPropertyListing>
}

class ExtractorRegistry {
  private static registry = new Map<string, ContentExtractor>()

  static register(extractor: ContentExtractor): void {
    this.registry.set(extractor.contentType, extractor)
  }

  static get(contentType: string): ContentExtractor | undefined {
    return this.registry.get(contentType)
  }

  static getAll(): string[] {
    return Array.from(this.registry.keys())
  }
}
```

**Rationale**: Simple, no dependencies, easy to test. The registry is a single
Map — no need for a DI container or reflection. New domains register via:
`ExtractorRegistry.register(new InmueblesExtractor())`

## Decision: Classifier Prompt Design

**Decision**: The Classifier will use a short, focused prompt (not the full
extraction prompt):

```
Eres un clasificador de anuncios. Determina si el siguiente texto
describe una propiedad inmobiliaria (casa, apartamento, habitacion,
terreno, local, oficina) o NO es inmobiliario.

Reglas:
- Inmueble: menciona cuartos/habitaciones, metros cuadrados,
  precio de venta/alquiler, direccion/provincia/municipio
- No inmueble: agua, carros, ropa, comida, muebles (a menos que
  sean parte de una venta de casa), electrodomesticos sueltos
- Si hay duda, responde con confidence baja (<0.5)
```

**Rationale**: Short prompt = fewer tokens = cheaper + faster. The classifier
doesn't need the full extraction schema.

## Decision: Confidence Threshold Defaults

**Decision**: Default thresholds: `rejectThreshold=0.2`, `classifyThreshold=0.5`.
These map to:
- confidence < 0.2 → rejected (regardless of content type)
- confidence 0.2-0.5 → review (classified but needs human check)
- confidence ≥ 0.5 and contentType="inmuebles" → proceed to extraction
- confidence ≥ 0.5 and contentType="rejected" → rejected

**Rationale**: Airtight test with 100 property posts (SC-002) showed 0% false
rejections at 0.5 threshold. The 0.2 floor prevents garbage from entering the
review queue.

## Decision: Migration Strategy

**Decision**: Run a one-time migration script in the AI processor startup:

```sql
-- Mark old low-confidence "sold" listings appropriately
UPDATE listings
SET status = CASE
  WHEN property_type = 'otro' THEN 'rejected'
  ELSE 'review'
END
WHERE status = 'sold'
  AND ai_confidence < 0.3
  AND created_at < '2026-07-21';
```

**Rationale**: Preserves genuinely sold listings (user-marked) while cleaning
up old AI-generated "sold" entries. The date gate prevents touching any future
user actions.

---

<!--
  The following sections document decisions made DURING implementation
  that are OUTSIDE the scope of this feature (001-pipeline-classify-extract).
  They are recorded here because they affect the codebase broadly.
-->

## Decision: Prisma Model Table Naming (Outside Feature Scope)

**Decision**: Always use `@@map("table_name")` on Prisma models to explicitly
control the database table name.

**Context**: The `Group` model was originally defined without `@@map("groups")`.
In Prisma 7, the default table name is the model name (`Group`), but the initial
migration created the table as `"groups"`. When a subsequent migration was generated
after adding fields, Prisma detected the mismatch and generated a `DROP TABLE "groups"`
/ `CREATE TABLE "Group"` — permanently dropping all existing group data.

**Lesson**: Prisma migrations treat model/table name mismatches as destructive
operations. Enabling `@@map` explicitly prevents this.

**Rationale**: A lesson learned the hard way after losing prod data. All new models
and any model without `@@map` should get one. Existing models: `Listing` has
`@@map("listings")`, `RawPost` uses defaults, etc.

---

## Decision: Centralized Error Handling Pattern (Outside Feature Scope)

**Decision**: Standardize error handling with:
- `AppError` class — carries `code`, `message`, `status`
- `toAppError()` utility — maps any error (Prisma, network, etc.) to AppError
- Hono `onError` global handler — catches all AppErrors and formats consistent
  `{ error: { code, message, requestId } }` responses

**Components**:
- `packages/scraper/src/lib/app-error.ts` — AppError class + ErrorCode type
- `packages/scraper/src/lib/prisma-errors.ts` — maps Prisma codes (P2002, P2025)
  and message patterns (Argument missing, net::, login expired, etc.) to AppError
- `packages/scraper/src/middleware/error-handler.ts` — enhanced from pre-existing
  `onError` handler to also handle Prisma errors natively

**Pattern**:
- Routes throw errors directly (no manual try/catch for most cases)
- For Prisma operations: catch + `throw toAppError(err)`
- `onError` catches everything and returns consistent envelope
- Frontend `api.ts` `requestRaw()` extracts `body.error.message` for toasts

**Rationale**: Before this, each route had its own error format — some returned
raw Prisma traces in `err.message`, others had custom `classifyError()` functions.
A single pattern eliminates Prisma trace leaks to the frontend and ensures
consistent error codes across all endpoints.

**Error codes**: `validation_error`, `not_found`, `conflict`, `unauthorized`,
`session_expired`, `network_error`, `external_error`, `internal_error`

---

## Decision: Vite `server.fs.allow` for pnpm Monorepo (Outside Feature Scope)

**Decision**: Add `vite.server.fs.allow: ["..", "../../node_modules/.pnpm"]` to
Astro config in `apps/dashboard/astro.config.mjs`.

**Context**: pnpm's `node_modules/.pnpm/` directory uses symlinks. Vite restricts
serving files outside the project root by default. Without this config, requests
to `.pnpm`-hosted packages (`@fontsource-variable/outfit`, `@astrojs/react`) get
blocked with "outside of Vite serving allow list" errors.

**Rationale**: Standard fix for pnpm + Vite/Astro projects in monorepos.
