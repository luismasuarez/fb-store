import { Link } from "react-router";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Listing } from "@/types";
import { formatPrice } from "@/lib/utils";
import { getImageUrl } from "@/lib/api";

interface Props {
  listing: Listing;
}

export function ListingCard({ listing }: Props) {
  const image = listing.images?.[0];

  return (
    <Link to={`/listings/${listing.id}`}>
      <Card className="overflow-hidden h-full hover:shadow-md transition-shadow">
        <div className="aspect-video bg-muted relative overflow-hidden">
          {image ? (
            <img
              src={getImageUrl(image)}
              alt={listing.title || "Listing"}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Sin imagen
            </div>
          )}
        </div>
        <CardHeader className="p-3 pb-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold truncate text-sm">
              {listing.title || "Sin título"}
            </p>
            <Badge variant="outline" className="shrink-0 text-xs">
              {listing.listingType || "—"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <p className="text-lg font-bold text-primary">
            {formatPrice(listing.price, listing.currency)}
          </p>
          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
            {listing.propertyType && <span>{listing.propertyType}</span>}
            {listing.bedrooms != null && <span>{listing.bedrooms} hab</span>}
            {listing.bathrooms != null && <span>{listing.bathrooms} baños</span>}
            {listing.totalM2 && <span>{listing.totalM2} m²</span>}
          </div>
          {listing.province && (
            <p className="text-xs text-muted-foreground mt-1">
              {listing.province}
              {listing.municipality ? `, ${listing.municipality}` : ""}
            </p>
          )}
        </CardContent>
        <CardFooter className="p-3 pt-0">
          {listing.summaryShort && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {listing.summaryShort}
            </p>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
