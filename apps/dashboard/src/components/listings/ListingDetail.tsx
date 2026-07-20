import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { Building2, Camera, ExternalLink, MapPin, Phone, User } from "@/lib/icon"

interface Props {
  id: string | null
  onClose: () => void
}

export default function ListingDetail({ id, onClose }: Props) {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) { setData(null); return }
    setLoading(true)
    api.listings.get(id)
      .then((res) => { setData(res.data); setLoading(false) })
      .catch(() => { setLoading(false); onClose() })
  }, [id])

  const l = data

  return (
    <Dialog open={!!id} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {!id || loading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !l ? null : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-start justify-between gap-4">
                <span className="text-base">{l.title || "Untitled"}</span>
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
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              {l.price != null && (
                <div className="text-xl font-semibold">
                  {Number(l.price).toLocaleString()} {l.currency || "CUP"}
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
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
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{[l.province, l.municipality, l.neighborhood].filter(Boolean).join(", ")}</span>
                </div>
              )}

              {(l.contactName || l.contactPhone) && (
                <div className="space-y-1">
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
                    <p className="whitespace-pre-wrap text-muted-foreground">{l.description}</p>
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
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground/70">{l.rawText}</p>
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
                    <p className="text-muted-foreground">{l.summaryShort}</p>
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
                            <div className="flex h-full items-center justify-center text-[20px] text-muted-foreground">
                              🖼
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
                  <div className="flex items-center gap-1.5">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate underline underline-offset-2 hover:text-foreground">
                      {l.sourceUrl}
                    </a>
                  </div>
                )}
                <div>Scraped: {new Date(l.scrapedAt).toLocaleString()}</div>
                {l.createdAt && <div>Created: {new Date(l.createdAt).toLocaleString()}</div>}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}