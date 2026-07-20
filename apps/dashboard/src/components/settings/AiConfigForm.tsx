import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Settings, Loader2, CheckCircle, AlertCircle, RefreshCw } from "@/lib/icon"
import { toast } from "sonner"

interface OpenRouterModel {
  id: string
  name: string
  context_length: number
  pricing: { prompt: string; completion: string; image: string; request: string }
  top_provider: { is_moderated: boolean; max_completion_tokens: number | null }
}

export default function AiConfigForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [provider, setProvider] = useState("openrouter")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("openai/gpt-4o-mini")
  const [apiKeyMasked, setApiKeyMasked] = useState("")

  const [models, setModels] = useState<OpenRouterModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/v1/ai/config", {
      headers: { "x-api-key": import.meta.env.PUBLIC_API_KEY },
    })
      .then((r) => r.json())
      .then((d) => {
        const cfg = d.data
        setProvider(cfg.provider || "openrouter")
        setModel(cfg.model || "openai/gpt-4o-mini")
        setApiKeyMasked(cfg.apiKeyMasked || "")
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function loadModels() {
    setModelsLoading(true)
    setModelsError(null)
    try {
      const res = await fetch(`/api/v1/ai/models`, {
        headers: { "x-api-key": import.meta.env.PUBLIC_API_KEY },
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message || "Failed to load models")
      const list: OpenRouterModel[] = d.data || []
      setModels(list)
      if (list.length > 0 && !list.some((m) => m.id === model)) {
        setModel(list[0].id)
      }
    } catch (err: any) {
      setModelsError(err.message)
      setModels([])
    } finally {
      setModelsLoading(false)
    }
  }

  async function save() {
    if (!apiKey && !apiKeyMasked) { toast.error("API Key is required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/v1/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.PUBLIC_API_KEY },
        body: JSON.stringify({ provider, apiKey: apiKey || apiKeyMasked, model }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message || "Save failed")
      setApiKey("")
      setApiKeyMasked(d.data.apiKeyMasked)

      await loadModels()

      toast.success("AI configuration saved")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/v1/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.PUBLIC_API_KEY },
        body: JSON.stringify({}),
      })
      const d = await res.json()
      const data = d.data
      if (data.success) {
        setTestResult({ success: true, message: `OK (${data.durationMs}ms) — "${data.result.title}"` })
      } else {
        setTestResult({ success: false, message: data.error || "Connection failed" })
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message })
    } finally {
      setTesting(false)
    }
  }

  const selectedModelMeta = models.find((m) => m.id === model)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          <Settings className="h-4 w-4 text-primary" />
          AI Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-48" />
          </div>
        ) : (
          <div className="max-w-md space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type="password"
                  placeholder={apiKeyMasked ? "Enter new key to change" : "sk-or-..."}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                {apiKeyMasked && !apiKey && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    {apiKeyMasked}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="model">Model</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  disabled={modelsLoading}
                  onClick={loadModels}
                >
                  {modelsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Load models
                </Button>
              </div>
              {modelsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : modelsError ? (
                <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{modelsError}</span>
                </div>
              ) : models.length > 0 ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-mono text-xs">{m.id}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="openai/gpt-4o-mini" />
              )}

              {selectedModelMeta && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>Context: {(selectedModelMeta.context_length / 1000).toFixed(0)}k</span>
                  <span>Prompt: ${Number(selectedModelMeta.pricing.prompt) * 1000}/M</span>
                  <span>Completion: ${Number(selectedModelMeta.pricing.completion) * 1000}/M</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
              <Button variant="outline" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                Test Connection
              </Button>
            </div>

            {testResult && (
              <div
                className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  testResult.success
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    : "border-red-500/30 bg-red-500/10 text-red-500"
                }`}
              >
                {testResult.success ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}