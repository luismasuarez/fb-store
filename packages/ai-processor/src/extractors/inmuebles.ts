import { ExtractorRegistry, extractWithOpenRouter } from "@fb-store/shared"
import type { ClassificationResult, ContentExtractor, StructuredPropertyListing } from "@fb-store/shared"
import { z } from "zod"

const INMUEBLES_SYSTEM_PROMPT = `Eres un extractor profesional de publicaciones inmobiliarias provenientes de Facebook Marketplace y grupos de compra/venta en Cuba.

Tu tarea es analizar el texto CRUDO de una publicacion y extraer TODA la informacion estructurada posible.

## REGLAS ESTRICTAS:
1. **SOLO extrae datos EXPLICITOS en el texto.** No inventes ni asumas informacion.
2. **Precio:** Busca el precio en la moneda indicada (CUP, USD, MLC, EUR). Si no hay moneda explicita, usa "CUP" como default.
3. **Telefono:** Busca patrones de telefono cubano: +53 5XXXXXXX, 5XXXXXXX, 7XXXXXXX, etc.
4. **Ubicacion:** Extrae provincia, municipio y barrio SI estan mencionados explicitamente.
5. **Imagenes:** Si el texto menciona "foto" o "video", reflejalo.
6. **Texto original:** Incluye el texto original completo en el campo descriptionClean.
7. **Confianza:** Asigna un confidenceScore entre 0.0 y 1.0 basado en cuanta informacion estructurada pudiste extraer. Textos muy cortos o vagos = baja confianza.

Responde UNICAMENTE con un objeto JSON valido. Sin markdown, sin explicaciones, SOLO JSON.`

const INMUEBLES_CLASSIFIER_PROMPT = `Eres un clasificador de anuncios inmobiliarios. Determina si el siguiente texto describe una propiedad inmobiliaria (casa, apartamento, habitacion, terreno, local, oficina) o NO es inmobiliario.

Reglas:
- Inmueble: menciona cuartos/habitaciones, metros cuadrados, precio de venta/alquiler, direccion/provincia/municipio
- No inmueble: agua, carros, ropa, comida, muebles (a menos que sean parte de una venta de casa), electrodomesticos sueltos
- Si hay duda, responde con confidence baja (<0.5)

Responde SOLO con un objeto JSON con los campos: contentType ("inmuebles" o "rejected"), confidence (0.0-1.0), reasoning (max 200 chars), detectedEntities (array de keywords)`

const listingSchema = z.object({
  listingType: z.enum(["venta", "alquiler", "alquiler_temporario", "compraventa"]),
  propertyType: z.enum(["casa", "apartamento", "habitacion", "local", "terreno", "oficina", "otro"]),
  title: z.string(),
  descriptionClean: z.string(),
  summaryShort: z.string(),
  price: z.string(),
  location: z.object({
    province: z.string().nullable(),
    municipality: z.string().nullable(),
    neighborhood: z.string().nullable(),
  }),
  propertyDetails: z.object({
    bedrooms: z.number().nullable(),
    bathrooms: z.number().nullable(),
    totalArea: z.string().nullable(),
    floors: z.number().nullable(),
  }),
  features: z.array(z.string()),
  includedItems: z.array(z.string()),
  services: z.array(z.string()),
  securityFeatures: z.array(z.string()),
  contact: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  media: z.object({
    images: z.array(z.string()),
  }),
  sellerNotes: z.string(),
  missingInformation: z.array(z.string()),
  confidenceScore: z.number(),
  rawEntitiesDetected: z.array(z.string()),
})

function cleanJsonResponse(raw: string): string {
  const jsonStart = raw.indexOf("{")
  const jsonEnd = raw.lastIndexOf("}")
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return raw.slice(jsonStart, jsonEnd + 1)
  }
  return raw.trim()
}

export class InmueblesExtractor implements ContentExtractor {
  readonly contentType = "inmuebles"
  readonly systemPrompt = INMUEBLES_SYSTEM_PROMPT
  readonly schema = listingSchema

  private apiKey = ""
  private extractModel = ""
  private classifierModel = ""

  configure(apiKey: string, extractModel: string, classifierModel: string): void {
    this.apiKey = apiKey
    this.extractModel = extractModel
    this.classifierModel = classifierModel
  }

  async classify(text: string): Promise<ClassificationResult> {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://fbstore.app",
        "X-OpenRouter-Title": "FB Store Classifier",
      },
      body: JSON.stringify({
        model: this.classifierModel,
        messages: [
          { role: "system", content: INMUEBLES_CLASSIFIER_PROMPT },
          { role: "user", content: `Texto del anuncio:\n\n${text}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 500,
      }),
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
  }

  async extract(text: string): Promise<StructuredPropertyListing> {
    const result = await extractWithOpenRouter(text, {
      apiKey: this.apiKey,
      model: this.extractModel,
    })

    const parsed = listingSchema.parse(result)
    return parsed as StructuredPropertyListing
  }
}

const inmueblesExtractor = new InmueblesExtractor()
ExtractorRegistry.register(inmueblesExtractor)
export default inmueblesExtractor
