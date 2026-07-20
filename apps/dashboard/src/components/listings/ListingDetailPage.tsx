import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { ArrowLeft, Building2, Camera, ExternalLink, MapPin, Phone, User } from "@/lib/icon"

interface ListingDetail {
  id: string
  title?: string
  price?: number
  currency: string
  status: string
  listingType?: string
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  totalM2?: number
  floors?: number
  parking?: boolean
  furnished?: boolean
  province?: string
  municipality?: string
  neighborhood?: string
  contactName?: string
  contactPhone?: string
  description?: string
  rawText?: string
  summaryShort?: string
  images?: any[]
  aiConfidence?: number
  sourceUrl?: string
  scrapedAt: string
  createdAt?: string
}

export default function ListingDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<ListingDetail | null>(null)

  useEffect(() => {
    api.listings.get(id)
      .then((res) => setData(res.data as ListingDetail))
      .catch(() => setData(null))
  }, [id])

  const loading = !data

  function goBack() {
    window.history.pushState(null, "", "/listings")
    window.dispatchEvent(new PopStateEvent("popstate"))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={goBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Listings
        </Button>
        <p className="py-16 text-center text-sm text-muted-foreground">Listing not found.</p>
      </div>
    )
  }

  const l = data

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={goBack}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Listings
      </Button>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="break-words text-xl font-semibold">{l.title || "Untitled"}</h1>
              {l.price != null && (
                <p className="mt-1 text-2xl font-semibold text-primary">
                  {Number(l.price).toLocaleString()} {l.currency || "CUP"}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Badge
                variant="outline"
                className={`text-[10px] capitalize ${
                  l.status === "active"
                    ? "border-emerald-500/30 text-emerald-500"
                    : "text-muted-foreground"
                }`}
              >
                {l.status}
              </Badge>
              {l.listingType && (
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {l.listingType}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {l.propertyType && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="capitalize">{l.propertyType}</span>
              </div>
            )}
            {l.bedrooms != null && (
              <div className="text-muted-foreground">
                {l.bedrooms} {l.bedrooms === 1 ? "bedroom" : "bedrooms"}
              </div>
            )}
            {l.bathrooms != null && (
              <div className="text-muted-foreground">
                {l.bathrooms} {l.bathrooms === 1 ? "bathroom" : "bathrooms"}
              </div>
            )}
            {l.totalM2 != null && (
              <div className="text-muted-foreground">{l.totalM2} m²</div>
            )}
            {l.floors != null && (
              <div className="text-muted-foreground">{l.floors} {l.floors === 1 ? "floor" : "floors"}</div>
            )}
            {l.parking != null && (
              <div className="text-muted-foreground">{l.parking ? "Parking" : "No parking"}</div>
            )}
            {l.furnished != null && (
              <div className="text-muted-foreground">{l.furnished ? "Furnished" : "Not furnished"}</div>
            )}
          </div>

          <Separator />

          {(l.province || l.municipality || l.neighborhood) && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{[l.province, l.municipality, l.neighborhood].filter(Boolean).join(", ")}</span>
            </div>
          )}

          {(l.contactName || l.contactPhone) && (
            <div className="space-y-1 text-sm">
              {l.contactName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span>{l.contactName}</span>
                </div>
              )}
              {l.contactPhone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{l.contactPhone}</span>
                </div>
              )}
            </div>
          )}

          {l.description && (
            <>
              <Separator />
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Description
                </div>
                <p className="break-words whitespace-pre-wrap text-sm text-muted-foreground">{l.description}</p>
              </div>
            </>
          )}

          {l.rawText && (
            <>
              <Separator />
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Raw text
                </div>
                <p className="break-words whitespace-pre-wrap text-xs text-muted-foreground/70">{l.rawText}</p>
              </div>
            </>
          )}

          {l.summaryShort && (
            <>
              <Separator />
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Summary
                </div>
                <p className="text-sm text-muted-foreground">{l.summaryShort}</p>
              </div>
            </>
          )}

          {l.images && l.images.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Camera className="h-3 w-3" />
                  Images ({l.images.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {l.images.map((img: any, i: number) => (
                    <div key={i} className="h-20 w-20 overflow-hidden rounded-md border bg-muted">
                      {typeof img === "string" && img.startsWith("data:") ? (
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Camera className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {l.aiConfidence != null && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>AI confidence:</span>
                <span
                  className={`font-medium ${
                    l.aiConfidence >= 0.7
                      ? "text-emerald-500"
                      : l.aiConfidence >= 0.3
                        ? "text-amber-500"
                        : "text-red-500"
                  }`}
                >
                  {(Number(l.aiConfidence) * 100).toFixed(0)}%
                </span>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-1 text-xs text-muted-foreground">
            {l.sourceUrl && (
              <div className="flex min-w-0 items-center gap-1.5">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate underline underline-offset-2 hover:text-foreground">
                  {l.sourceUrl}
                </a>
              </div>
            )}
            <div>Scraped: {new Date(l.scrapedAt).toLocaleString()}</div>
            {l.createdAt && <div>Created: {new Date(l.createdAt).toLocaleString()}</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
