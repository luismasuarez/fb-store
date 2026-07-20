export interface OpenRouterModel {
  id: string
  name: string
  created?: number
  description?: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
    image: string
    request: string
  }
  architecture: {
    modality: string
    tokenizer: string
    instruct_type: string | null
  }
  top_provider: {
    max_completion_tokens: number | null
    is_moderated: boolean
  }
  per_request_limits: Record<string, unknown> | null
}

export interface ModelsResponse {
  data: OpenRouterModel[]
}

export async function fetchAvailableModels(): Promise<OpenRouterModel[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`OpenRouter models HTTP ${res.status}: ${body.slice(0, 200)}`)
    }

    const json: ModelsResponse = await res.json()
    const models = json.data || []

    return models
      .filter((m) => m.architecture?.modality === "text" || m.architecture?.modality?.includes("text"))
      .sort((a, b) => {
        const aPop = a.top_provider?.is_moderated ? 0 : 1
        const bPop = b.top_provider?.is_moderated ? 0 : 1
        return bPop - aPop
      })
  } finally {
    clearTimeout(timer)
  }
}
