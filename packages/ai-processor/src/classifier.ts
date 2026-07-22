import { ExtractorRegistry } from "@fb-store/shared"
import type { ClassificationResult } from "@fb-store/shared"

const TIMEOUT_MS = 15_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 3_000

const CLASSIFIER_SYSTEM_PROMPT = `Eres un clasificador de anuncios. Determina si el siguiente texto describe una propiedad inmobiliaria (casa, apartamento, habitacion, terreno, local, oficina) o NO es inmobiliario.

Reglas:
- Inmueble: menciona cuartos/habitaciones, metros cuadrados, precio de venta/alquiler, direccion/provincia/municipio
- No inmueble: agua, carros, ropa, comida, muebles (a menos que sean parte de una venta de casa), electrodomesticos sueltos
- Si hay duda, responde con confidence baja (<0.5)

Responde SOLO con un objeto JSON con los campos: contentType ("inmuebles" o "rejected"), confidence (0.0-1.0), reasoning (max 200 chars), detectedEntities (array de keywords)`

function cleanJsonResponse(raw: string): string {
  const jsonStart = raw.indexOf("{")
  const jsonEnd = raw.lastIndexOf("}")
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return raw.slice(jsonStart, jsonEnd + 1)
  }
  return raw.trim()
}

async function callClassifier(text: string, apiKey: string, model: string): Promise<ClassificationResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://fbstore.app",
        "X-OpenRouter-Title": "FB Store Classifier",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
          { role: "user", content: `Texto del anuncio:\n\n${text}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 500,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Classifier HTTP ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content
    if (!content) throw new Error("Empty response from classifier")

    const cleaned = cleanJsonResponse(content)
    const parsed = JSON.parse(cleaned) as ClassificationResult
    return {
      contentType: parsed.contentType === "inmuebles" ? "inmuebles" : "rejected",
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0)),
      reasoning: (parsed.reasoning ?? "").slice(0, 200),
      detectedEntities: Array.isArray(parsed.detectedEntities) ? parsed.detectedEntities.slice(0, 10) : [],
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function classifyPost(text: string, apiKey: string, model: string): Promise<ClassificationResult> {
  const truncated = text.length > 8000 ? text.slice(0, 8000) : text
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    try {
      const result = await callClassifier(truncated, apiKey, model)
      return result
    } catch (err: any) {
      lastError = err
    }
  }

  throw lastError ?? new Error("Classification failed after retries")
}

export async function classifyWithPurpose(
  text: string,
  apiKey: string,
  classifierModel: string,
  groupPurpose: string | null,
): Promise<ClassificationResult> {
  if (groupPurpose) {
    const extractor = ExtractorRegistry.get(groupPurpose)
    if (extractor) {
      return extractor.classify(text)
    }
  }

  return classifyPost(text, apiKey, classifierModel)
}
