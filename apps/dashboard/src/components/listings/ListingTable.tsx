import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Home, Search, ChevronLeft, ChevronRight, RefreshCw } from "@/lib/icon"
import { api } from "@/lib/api"
import { toast } from "sonner"

interface Listing {
  id: string
  title?: string
  price?: number
  currency: string
  listingType?: string
  propertyType?: string
  province?: string
  municipality?: string
  status: string
  aiConfidence?: number
  scrapedAt: string
  images: any[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function ListingTable() {
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [listingType, setListingType] = useState("")
  const [propertyType, setPropertyType] = useState("")
  const [sort, setSort] = useState("newest")

  function buildUrl(): string {
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", "20")
    if (search) params.set("search", search)
    if (listingType) params.set("listing_type", listingType)
    if (propertyType) params.set("property_type", propertyType)
    if (sort === "price_asc") params.set("sort", "price_asc")
    else if (sort === "price_desc") params.set("sort", "price_desc")
    return `/api/v1/listings?${params}`
  }

  function load() {
    fetch(buildUrl())
      .then((r) => r.json())
      .then((d) => {
        setListings(d.data ?? [])
        setPagination(d.pagination ?? null)
      })
      .catch(() => { setListings([]); toast.error("Failed to load listings") })
  }

  useEffect(load, [page, listingType, propertyType, sort])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    load()
  }

  const typeCounts: Record<string, number> = {}
  if (listings) {
    listings.forEach((l) => {
      const t = l.listingType || "unknown"
      typeCounts[t] = (typeCounts[t] || 0) + 1
    })
  }

  function formatPrice(p: number | undefined, c: string): string {
    if (p == null) return "—"
    return `${Number(p).toLocaleString()} ${c || "CUP"}`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-heading">
            <Home className="h-4 w-4 text-primary" />
            Listings
            {pagination && <span className="text-xs font-normal text-muted-foreground">({pagination.total})</span>}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="relative flex-1 basis-48">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search listings..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <Select value={listingType} onValueChange={(v) => { setListingType(v); setPage(1) }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All types</SelectItem>
              <SelectItem value="venta">Sale</SelectItem>
              <SelectItem value="alquiler">Rent</SelectItem>
              <SelectItem value="alquiler_temporario">Temp Rent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={propertyType} onValueChange={(v) => { setPropertyType(v); setPage(1) }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All property" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All property</SelectItem>
              <SelectItem value="casa">House</SelectItem>
              <SelectItem value="apartamento">Apartment</SelectItem>
              <SelectItem value="habitacion">Room</SelectItem>
              <SelectItem value="terreno">Land</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price ↑</SelectItem>
              <SelectItem value="price_desc">Price ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!listings ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : listings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No listings found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {l.images?.length > 0 && <span className="mr-1">📷</span>}
                    {l.title || l.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatPrice(l.price, l.currency)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {l.listingType || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[l.province, l.municipality].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(l.scrapedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
