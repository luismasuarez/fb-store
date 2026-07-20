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
import { api } from "@/lib/api"

export default function AiConfigForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [provider, setProvider] = useState("openrouter")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("openai/gpt-4o-mini")
  const [apiKeyMasked, setApiKeyMasked] = useState("")

  useEffect(() => {
    fetch("/api/v1/ai/config")
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
              <Label htmlFor="model">Model</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="openai/gpt-4o-mini" />
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
