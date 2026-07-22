# Contract: Classifier Stage

## Input
```typescript
// Raw post text after cleaning (Cleaner stage output)
text: string  // 20-10000 chars, already sanitized of Facebook UI noise
```

## Output
```typescript
ClassificationResult {
  contentType: "inmuebles" | "rechazado"
  confidence: number        // 0.0 to 1.0
  reasoning: string         // max 200 chars, human-readable
  detectedEntities: string[] // keywords found, max 10 items
}
```

## Behavior
- MUST classify in under 5 seconds per post (using Gemini Flash via OpenRouter)
- MUST NOT call the Extractor — classification only
- MUST log every classification with post ID, result, confidence, timing
- If the AI provider returns an error, MUST retry up to 2 times with 3s delay
