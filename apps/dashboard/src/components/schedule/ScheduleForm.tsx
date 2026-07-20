import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Activity, Loader2 } from "@/lib/icon"
import { api } from "@/lib/api"
import { toast } from "sonner"
import type { ScheduleConfig } from "@/lib/types"

export default function ScheduleForm() {
  const [config, setConfig] = useState<ScheduleConfig | null>(null)
  const [interval, setInterval] = useState(240)
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.schedule.get().then((c) => {
      setConfig(c)
      setInterval(c.intervalMinutes)
      setEnabled(c.enabled)
    }).catch(() => setConfig({ intervalMinutes: 240, enabled: true }))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const c = await api.schedule.update({ intervalMinutes: interval, enabled })
      setConfig(c)
      toast.success("Schedule updated")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          <Activity className="h-4 w-4 text-primary" />
          Scrape Schedule
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!config ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-48" />
          </div>
        ) : (
          <div className="space-y-6 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="interval">Interval (minutes)</Label>
              <Input
                id="interval"
                type="number"
                min={30}
                max={1440}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 30 minutes. Every {interval} minutes.
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  {enabled ? "Scraping runs on schedule" : "Scheduler is paused"}
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Schedule
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
