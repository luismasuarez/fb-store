import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, CheckCircle, AlertCircle } from "@/lib/icon"
import { toast } from "sonner"

export default function AiProcessCard() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ processed: number; errors: number } | null>(null)

  async function handleProcess() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/v1/ai/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.PUBLIC_API_KEY,
        },
      })
      const d = await res.json()
      const data = d.data ?? d
      if (!res.ok) throw new Error(data?.error?.message || "Process failed")
      setResult(data)
      toast.success(`Processed ${data.processed} posts (${data.errors} errors)`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Processing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Process pending raw posts through AI to create structured listings.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={handleProcess} disabled={loading} size="sm">
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {loading ? "Processing..." : "Process Pending"}
          </Button>
          {result && (
            <span className="flex items-center gap-1.5 text-xs">
              {result.errors > 0 ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              )}
              {result.processed} processed, {result.errors} errors
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
