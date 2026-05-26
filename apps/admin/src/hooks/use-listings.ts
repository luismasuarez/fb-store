import { useQuery } from "@tanstack/react-query";
import {
  fetchListings,
  fetchListing,
  type ListingFilters,
} from "@/lib/api";

export function useListings(filters: ListingFilters) {
  return useQuery({
    queryKey: ["listings", filters],
    queryFn: () => fetchListings(filters),
  });
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ["listing", id],
    queryFn: () => fetchListing(id!),
    enabled: !!id,
  });
}
