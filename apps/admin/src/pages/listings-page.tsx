import { useState, useCallback } from "react";
import { useListings } from "@/hooks/use-listings";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingTable } from "@/components/listings/listing-table";
import { ListingFilters, type FilterValues } from "@/components/listings/listing-filters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Listing } from "@/types";

const DEFAULT_FILTERS: FilterValues = {
  listingType: "",
  propertyType: "",
  province: "",
  bedrooms: "",
  minPrice: "",
  maxPrice: "",
  sort: "",
  search: "",
};

export function ListingsPage() {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const apiFilters = {
    ...(filters.listingType && { listingType: filters.listingType }),
    ...(filters.propertyType && { propertyType: filters.propertyType }),
    ...(filters.province && { province: filters.province }),
    ...(filters.bedrooms && { bedrooms: Number(filters.bedrooms) }),
    ...(filters.minPrice && { minPrice: Number(filters.minPrice) }),
    ...(filters.maxPrice && { maxPrice: Number(filters.maxPrice) }),
    ...(filters.sort && { sort: filters.sort }),
    ...(filters.search && { search: filters.search }),
    page,
    limit: 20,
  };

  const { data, isLoading } = useListings(apiFilters);

  const handleFiltersChange = useCallback((vals: FilterValues) => {
    setFilters(vals);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Listings</h1>
        <div className="flex gap-2">
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("grid")}
          >
            Grid
          </Button>
          <Button
            variant={view === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("table")}
          >
            Tabla
          </Button>
        </div>
      </div>

      <ListingFilters values={filters} onChange={handleFiltersChange} />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.data.map((listing) => (
            <ListingCard key={listing.id} listing={listing as unknown as Listing} />
          ))}
          {data?.data.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-12">
              No se encontraron listings
            </p>
          )}
        </div>
      ) : (
        <ListingTable listings={data?.data as unknown as Listing[] || []} />
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {data.pagination.page} de {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
