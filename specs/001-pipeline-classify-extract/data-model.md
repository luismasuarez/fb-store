# Data Model: Pipeline Classify-Extract Refactor

## Modified Entity: Group

New fields added to the existing `Group` model:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `purpose` | String? | `null` | Content domain (e.g., "inmuebles", "vehiculos"). Null = use general classifier |
| `rejectThreshold` | Float | `0.2` | Posts with classifier confidence below this are rejected regardless of type |
| `classifyThreshold` | Float | `0.5` | Posts with classifier confidence above this proceed to extraction |

**State transition** (thresholds):

```
                 classifier confidence
  ────────────────────────────────────────────────►
  rejected            review              extraction
  │                   │                     │
  0                 0.2                   0.5         1.0
  rejectThreshold          classifyThreshold
```

## Modified Entity: Listing

The existing `Listing` model's `status` field gains two new valid values:

| Status | Meaning | Set by |
|--------|---------|--------|
| `active` | Approved listing, visible in dashboard | AI (high confidence) or user (approve from review) |
| `review` | Pending manual approval | AI (borderline confidence) |
| `rejected` | Filtered out, not shown | AI (non-real-estate) or user (reject from review) |
| `sold` | Was active, now sold (manual only) | User only (dashboard action) |

**State diagram**:

```
                  ┌─────────┐
                  │ scraped │
                  └────┬────┘
                       │
                  ┌────▼────┐
                  │classify │
                  └────┬────┘
                       │
          ┌────────────┼────────────┐
          │ low        │ mid        │ high
          ▼            ▼            ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐
     │rejected │ │ review  │ │ active  │
     └─────────┘ └────┬────┘ └────┬────┘
          ▲            │           │
          │       ┌────▼────┐     │ user marks sold
          │       │ approve │     ▼
          │       │ /reject │ ┌─────────┐
          │       └────┬────┘ │  sold   │
          │            │      └─────────┘
          └────────────┘
          (restore from rejected)
```

## New Stage Interfaces

### ClassificationResult

| Field | Type | Description |
|-------|------|-------------|
| `contentType` | `"inmuebles" \| "rejected"` | Classified content domain |
| `confidence` | `number` (0.0-1.0) | How sure the classifier is |
| `reasoning` | `string` | Short explanation (debugging only) |
| `detectedEntities` | `string[]` | Keywords found in text |

### ContentExtractor (interface)

| Method | Input | Output |
|--------|-------|--------|
| `classify(text)` | raw post text | `ClassificationResult` |
| `extract(text, previousResult?)` | raw post text + optional classification context | `StructuredPropertyListing` |

## Database Changes (Prisma)

```prisma
// Added to Group model:
purpose          String?   @map("purpose")
rejectThreshold  Float     @default(0.2) @map("reject_threshold")
classifyThreshold Float    @default(0.5) @map("classify_threshold")

// No changes to Listing schema — status field already exists as String
// The "review" and "rejected" values are now valid alongside "active" and "sold"
```
