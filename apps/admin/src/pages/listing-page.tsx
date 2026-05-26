import { useParams, Link } from "react-router";
import { useListing } from "@/hooks/use-listings";
import { ListingDetail } from "@/components/listings/listing-detail";

export function ListingPage() {
  const { id } = useParams();
  const { data: listing, isLoading } = useListing(id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/listings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volver
        </Link>
      </div>
      <ListingDetail listing={listing ?? undefined} loading={isLoading} />
    </div>
  );
}
