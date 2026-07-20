import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, RefreshCw } from "@/lib/icon"
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
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    api.profiles.list().then(setProfiles).catch(() => {})
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
      const data = await api.scrape.run({
        groupId: effectiveGroupId,
        maxPosts,
        profile,
      })
      const metrics = data.metrics
      setResult(`Found ${metrics.postsFound} posts, ${metrics.postsNew} new (${metrics.durationMs}ms)`)
      toast.success(`Scraped ${metrics.postsNew} new posts`)
    } catch (err: any) {
      toast.error(err.message)
      setResult(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          <RefreshCw className="h-4 w-4 text-primary" />
          Quick Scrape
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                placeholder="https://facebook.com/groups/..."
                value={url}
                onChange={(e) => { setUrl(e.target.value); setGroupId("") }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group">Saved Group</Label>
              <Select value={groupId} onValueChange={(v) => { setGroupId(v); setUrl("") }}>
                <SelectTrigger id="group">
                  <SelectValue placeholder="— Manual —" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="maxPosts">Max Posts</Label>
              <Input
                id="maxPosts"
                type="number"
                min={1}
                max={200}
                value={maxPosts}
                onChange={(e) => setMaxPosts(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile">Account</Label>
              <Select value={profile} onValueChange={setProfile}>
                <SelectTrigger id="profile">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Scraping..." : "Scrape Now"}
              </Button>
            </div>
          </div>
        </form>
        {result && (
          <>
            <Separator className="my-4" />
            <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              {result}
            </pre>
          </>
        )}
      </CardContent>
    </Card>
  )
}
