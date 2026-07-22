# Feature Specification: Pipeline Classify-Extract Refactor

**Feature Branch**: `001-pipeline-classify-extract`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "todo en una, bien extensa y definida, procede a crear la spec para 'Referencias de Proyectos Profesionales'"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Classification and Rejection of Non-Real-Estate Posts (Priority: P1)

As a user of fb-store, I want the system to automatically detect and reject
posts that are NOT about real estate (e.g., water tanks, electronics, cars,
clothing) so that the dashboard only shows relevant property listings.

**Why this priority**: This is the primary motivation for the entire refactor.
Currently, non-real-estate posts pollute the dashboard and create noise. Without
this, the project cannot be used reliably.

**Independent Test**: Can be tested by configuring a Facebook group known to have
mixed content, running a scrape cycle, and verifying that posts about non-real-estate
items are marked as "rejected" while posts about houses/apartments are marked as
"active". No dashboard changes needed — status changes alone demonstrate the value.

**Acceptance Scenarios**:

1. **Given** a scraped post containing text about a water tank ("Vendo tanque de
   agua de 500 litros, nuevo, $5000 CUP"), **When** the AI processor runs the
   classifier stage, **Then** the post is classified as non-real-estate and
   rejected without attempting property extraction.
2. **Given** a scraped post containing text about a house ("Vendo casa en Playa,
   3 cuartos, 2 baños, $25000 USD"), **When** the AI processor runs the
   classifier stage, **Then** the post passes classification and proceeds to the
   extractor stage.
3. **Given** a scraped post with very short text ("Vendo todo"), **When** the
   classifier stage runs, **Then** the post is marked for review (low confidence)
   until a human can inspect it.
4. **Given** a logged scrape cycle, **When** the AI processor finishes processing
   a batch, **Then** the user can see in the dashboard how many posts were
   classified, rejected, and sent to review.

---

### User Story 2 - Listing Status Review Queue (Priority: P2)

As a user, I want to see a queue of listings that the AI was unsure about so
that I can manually review them and decide whether to publish or reject them.

**Why this priority**: Currently, low-confidence posts are silently marked as
"sold" (semantically incorrect and hidden). A review queue gives the user control
over borderline cases, improves data quality, and builds trust in the system.

**Independent Test**: Can be tested by processing a post with ambiguous content,
verifying it appears in a "Review" section of the dashboard with accept/reject
buttons, then accepting it and confirming it moves to "Active" listings.

**Acceptance Scenarios**:

1. **Given** a post with AI confidence between 30% and 50%, **When** the
   processor finishes, **Then** a listing is created with status "review"
   and appears in a dedicated review section of the dashboard.
2. **Given** a listing in the review section, **When** the user clicks
   "Approve", **Then** the listing status changes to "active" and it appears
   in the main listings table.
3. **Given** a listing in the review section, **When** the user clicks
   "Reject", **Then** the listing status changes to "rejected" and it is
   hidden from the main listings table.
4. **Given** a post that was previously rejected, **When** the user navigates
   to a "Rejected" tab, **Then** they can see rejected listings and optionally
   restore them.

---

### User Story 3 - Content-Type Routing for Future Expansion (Priority: P3)

As a developer, I want the pipeline to support multiple content types (real
estate, vehicles, etc.) through a routing mechanism so that new domains can be
added without modifying existing code.

**Why this priority**: This is the architectural foundation for expanding the
project beyond real estate. It enables the "multi-purpose scraper" vision without
disrupting the current focus on houses for sale.

**Independent Test**: Can be tested by implementing a mock "vehicles" classifier
and extractor, configuring a test group with purpose "vehicles", and verifying
that the pipeline routes posts through the correct extractor. No real Facebook
groups needed for the test — mocked input suffices.

**Acceptance Scenarios**:

1. **Given** a Group configured with purpose "inmuebles", **When** a post from
   that group is processed, **Then** the pipeline uses the real estate classifier
   and extractor.
2. **Given** a Group configured with purpose "vehiculos", **When** a post from
   that group is processed, **Then** the pipeline uses the vehicle classifier
   and extractor (if implemented).
3. **Given** a Group with no purpose configured, **When** a post is processed,
   **Then** the pipeline uses a default/general classifier that routes to the
   most likely extractor or marks for review.
4. **Given** the real estate extractor, **When** a developer inspects its
   implementation, **Then** the extractor is a self-contained module with its
   own prompt, Zod schema, and confidence logic — independent of all other
   extractors.

### Edge Cases

- **Multi-category post**: A post saying "Vendo casa y carro" — the classifier
  should route to real estate extraction but flag the non-real-estate items as
  notes rather than rejecting the whole post.
- **Image-only post**: A post with no text, only images — the classifier cannot
  determine the category, so it goes to "review" status for manual inspection.
- **Classifier disagreement**: If the classifier says "inmuebles" but the
  extractor finds zero real estate data (confidence 0%), the listing should be
  created as "review" rather than "rejected" to avoid false negatives.
- **Empty batch**: A scrape cycle that finds zero new posts — no classification
  or extraction runs, the processor logs "0 posts to process" and waits for the
  next poll cycle.
- **Migration of existing data**: Posts that were previously marked as "sold"
  due to low confidence need to be re-evaluated or manually reviewed — they
  should not be lost during migration.
- **Classifier model failure**: If the AI provider returns an error or timeout
  during classification, the post should be queued for retry rather than
  silently skipped.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST have a Classifier stage that runs BEFORE the
  Extractor stage. It receives raw post text and outputs a classification
  result (content type + confidence score).
- **FR-002**: The Classifier MUST support at minimum two outputs: "inmuebles"
  (real estate) and "rechazado" (rejected/non-real-estate). Future content
  types MUST be addable without modifying existing classifier code.
- **FR-003**: Posts classified as "rechazado" with confidence at or above the
  group's `rejectThreshold` MUST be stored as listings with status "rejected"
  and MUST NOT proceed to extraction.
- **FR-004**: Posts classified as "inmuebles" with confidence at or above the
  group's `classifyThreshold` MUST proceed to the Extractor stage.
- **FR-005**: Posts with classification confidence between the group's
  `rejectThreshold` and `classifyThreshold` MUST proceed to extraction but the
  resulting listing MUST be created with status "review".
- **FR-006**: Posts with classification confidence below the group's
  `rejectThreshold` MUST be stored as "rejected" regardless of content.
- **FR-007**: The system MUST support three listing statuses: "active" (approved,
  visible), "review" (pending manual approval), "rejected" (filtered out). The
  existing "sold" status MUST be preserved for manual use (user marks an active
  listing as sold).
- **FR-008**: The dashboard MUST include a "Review" view that shows all listings
  with status "review", sorted by scraped date (oldest first).
- **FR-009**: The dashboard MUST provide "Approve" and "Reject" actions for each
  listing in the review view.
- **FR-010**: The dashboard MUST include a "Rejected" tab that shows rejected
  listings with an option to restore them to "review" or "active".
- **FR-011**: The Groups model MUST include a "purpose" field (e.g.,
  "inmuebles", "vehiculos") that determines which classifier and extractor to
  use for posts from that group. It MUST also include two configurable
  confidence threshold fields: `rejectThreshold` (default 0.2) and
  `classifyThreshold` (default 0.5). These thresholds control when a post is
  rejected, sent to review, or allowed through to extraction.
- **FR-012**: The Classifier and Extractor MUST communicate through a
  well-defined data contract (Zod schema) — no shared state or implicit
  dependencies between them.
- **FR-013**: The Classifier MUST use a lightweight LLM model (e.g., Gemini
  Flash, GPT-4o-mini) to minimize API costs. The model choice MUST be
  configurable via the same AI config mechanism used for the extractor.
- **FR-014**: The Extractor for the "inmuebles" domain MUST extract all current
  fields (price, currency, location, bedrooms, bathrooms, area, floors, parking,
  furnished, features, contact, etc.) with Zod validation on the output.
- **FR-015**: Each extractor MUST be a self-contained module with its own system
  prompt, Zod output schema, and confidence logic. No extractor MAY depend on
  another extractor's internal code.
- **FR-020**: The system MUST use a Registry pattern for extractors. Each
  extractor registers itself with an `ExtractorRegistry` singleton under a
  content type key (e.g., "inmuebles"). The pipeline queries the registry by
  group purpose to select the correct extractor. Adding a new domain requires
  only: creating the extractor module and registering it — no pipeline or
  routing code changes.
- **FR-016**: The AI processor's `processPost()` loop MUST route each post
  through: Cleaner → Classifier → (if classified as inmuebles) Extractor →
  Transformer → Storer. If classified as rejected, it MUST skip extraction and
  store directly.
- **FR-017**: Existing posts with status "sold" that were created by the old
  low-confidence logic MUST be migrated: posts with `aiConfidence < 0.3` and
  `propertyType = "otro"` become "rejected"; posts with `aiConfidence < 0.3`
  and `propertyType != "otro"` become "review".
- **FR-018**: The API endpoint `GET /api/v1/listings` MUST support filtering
  by status (active/review/rejected/sold) and MUST default to showing only
  "active" listings when no status filter is provided.
- **FR-019**: The AI processor MUST log classification decisions (post ID,
  classification result, confidence score, processing time) for debugging and
  auditing.

### Key Entities

- **ClassificationResult**: The output of the Classifier stage. Contains:
  content type (e.g., "inmuebles", "rechazado"), confidence score (0.0-1.0),
  reasoning snippet (for debugging), and raw entities detected.
- **ContentExtractor**: Interface/abstract class that defines the contract for
  domain-specific extractors. Methods: `classify(text): ClassificationResult`,
  `extract(text): StructuredListing`, `schema: ZodSchema`.
- **ExtractorRegistry**: Singleton that maps content types ("inmuebles") to
  their extractor implementations. New extractors register themselves; no
  registry code changes needed when adding a domain.
- **ReviewAction**: A user action on a review listing: "approve" (→ active),
  "reject" (→ rejected). Logged with timestamp and user identity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of non-real-estate posts (e.g., water tanks, electronics, car
  parts) are correctly classified as "rechazado" and never appear in the main
  listings view.
- **SC-002**: 0% of valid real estate posts (houses, apartments, land) are
  incorrectly classified as "rechazado" in production testing with a sample of
  100 verified property posts.
- **SC-003**: A new content domain (e.g., "vehiculos") can be added to the
  system in under 2 hours of development time, requiring only: a new extractor
  module with its own classifier prompt and Zod schema, plus registering it
  with the ExtractorRegistry. No pipeline, routing, or existing code changes
  are needed.
- **SC-004**: A listing classified with borderline confidence (30-50%) appears
  in the review queue within 5 minutes of its post being scraped.
- **SC-005**: A user can review and approve/reject a listing from the review
  queue in under 10 seconds per listing.
- **SC-006**: The Classifier stage consumes no more than 30% of the total AI
  processing cost per post (the Extractor consumes the remaining 70%+), when
  using a cheap model for classification versus a capable model for extraction.

## Assumptions

- The Classifier will use a cheaper/faster LLM model than the Extractor. The
  default pairing is Gemini Flash (classifier) + GPT-4o or Claude Sonnet
  (extractor), both available via OpenRouter.
- Classification is purely text-based (post text content). Images are not
  analyzed for classification purposes in this feature.
- Posts shorter than 20 characters are discarded before classification (existing
  behavior, unchanged).
- The "sold" status is preserved for manual use by the dashboard user — not set
  automatically by the AI processor anymore.
- Migration of existing listings with old "sold" values is a one-time operation.
  It can be run as a script or performed during the first AI processor startup
  after deployment.
- Review actions (approve/reject) do not require authentication for v1 —
  anyone with access to the dashboard can perform them.
- The feature is scoped to the "inmuebles" domain initially. The "vehiculos"
  domain is used only for testing the extensibility mechanism; its full
  implementation is out of scope.
- Default threshold values are: `rejectThreshold = 0.2` (posts below 20%
  confidence are always rejected) and `classifyThreshold = 0.5` (posts above
  50% confidence proceed directly to extraction). Posts between these values
  go to review. These defaults apply unless overridden per group.
