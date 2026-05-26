import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { useListings } from "@/hooks/use-listings";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingTable } from "@/components/listings/listing-table";
import { ListingFilters, type FilterValues } from "@/components/listings/listing-filters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Listing } from "@/types";

function filtersFromParams(params: URLSearchParams): FilterValues {
  return {
    listingType: params.get("listing_type") || "",
    propertyType: params.get("property_type") || "",
    province: params.get("province") || "",
    bedrooms: params.get("bedrooms") || "",
    minPrice: params.get("min_price") || "",
    maxPrice: params.get("max_price") || "",
    sort: params.get("sort") || "",
    search: params.get("search") || "",
  };
}

function filtersToParams(filters: FilterValues, page: number): Record<string, string> {
  const p: Record<string, string> = {};
  if (filters.listingType) p.listing_type = filters.listingType;
  if (filters.propertyType) p.property_type = filters.propertyType;
  if (filters.province) p.province = filters.province;
  if (filters.bedrooms) p.bedrooms = filters.bedrooms;
  if (filters.minPrice) p.min_price = filters.minPrice;
  if (filters.maxPrice) p.max_price = filters.maxPrice;
  if (filters.sort) p.sort = filters.sort;
  if (filters.search) p.search = filters.search;
  if (page > 1) p.page = String(page);
  return p;
}

export function ListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = filtersFromParams(searchParams);
  const page = Number(searchParams.get("page") || "1");

  const updateParams = useCallback(
    (newFilters: FilterValues, newPage: number) => {
      setSearchParams(filtersToParams(newFilters, newPage), { replace: true });
    },
    [setSearchParams],
  );

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

  const handleFiltersChange = useCallback(
    (vals: FilterValues) => {
      updateParams(vals, 1);
    },
    [updateParams],
  );

  const currentView = searchParams.get("view") === "table" ? "table" : "grid";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Listings</h1>
        <div className="flex gap-2">
          <Button
            variant={currentView === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setSearchParams((prev) => { prev.set("view", "grid"); return prev; }, { replace: true })}
          >
            Grid
          </Button>
          <Button
            variant={currentView === "table" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setSearchParams(
                (prev) => {
                  prev.set("view", "table");
                  return prev;
                },
                { replace: true },
              )
            }
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
      ) : currentView === "grid" ? (
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

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateParams(filters, page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {data.pagination.page} de {data.pagination.totalPages}
            ({data.pagination.total} total)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pagination.totalPages}
            onClick={() => updateParams(filters, page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
