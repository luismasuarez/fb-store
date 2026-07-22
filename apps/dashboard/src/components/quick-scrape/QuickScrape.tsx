import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, RefreshCw, CheckCircle, AlertCircle } from "@/lib/icon"
import { api, extractGroupId } from "@/lib/api"
import { toast } from "sonner"
import type { Profile, Group } from "@/lib/types"

export default function QuickScrape() {
  const [url, setUrl] = useState("")
  const [groupId, setGroupId] = useState("")
  const [maxPosts, setMaxPosts] = useState(20)
  const [profile, setProfile] = useState("")
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    api.profiles.list().then((list) => {
      setProfiles(list)
      const def = list.find((p) => p.isDefault)
      if (def) setProfile(def.name)
    }).catch(() => {})
    api.groups.list().then(setGroups).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profile) { toast.error("Select an account"); return }

    const effectiveGroupId = groupId || extractGroupId(url)
    if (!effectiveGroupId) { toast.error("Enter a URL or select a saved group"); return }

    setLoading(true)
    setResult(null)
    try {
      const data = await api.scrape.run({ groupId: effectiveGroupId, maxPosts, profile })
      const m = data.metrics
      const msg = `Scraped ${m.postsNew} new posts from ${m.postsFound} found (${(m.durationMs / 1000).toFixed(1)}s)`
      setResult({ ok: true, message: msg })
      toast.success(msg)
    } catch (err: any) {
      const msg = err.message
      setResult({ ok: false, message: msg })
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          <RefreshCw className="h-4 w-4 text-primary" />
          Quick Scrape
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <div className="relative">
                <Input
                  id="url"
                  placeholder="https://facebook.com/groups/... or select a saved group"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setGroupId("") }}
                  className="pr-9"
                />
                {groups.length > 0 && (
                  <Select value={groupId} onValueChange={(v) => { setGroupId(v); setUrl("") }}>
                    <SelectTrigger className="absolute right-0 top-0 h-full w-auto border-0 bg-transparent px-2 shadow-none hover:bg-accent/50 [&>svg]:h-3 [&>svg]:w-3">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id} className="text-xs">{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="w-20">
              <Input
                id="maxPosts"
                type="number"
                min={1}
                max={200}
                value={maxPosts}
                onChange={(e) => setMaxPosts(Number(e.target.value))}
                placeholder="Posts"
              />
            </div>
            <div className="w-36">
              <Select value={profile} onValueChange={setProfile}>
                <SelectTrigger>
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {loading ? "Scraping..." : "Scrape Now"}
            </Button>
          </div>
        </form>

        {result && (
          <div
            className={`mt-4 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
              result.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                : "border-red-500/30 bg-red-500/10 text-red-500"
            }`}
          >
            {result.ok ? (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{result.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
