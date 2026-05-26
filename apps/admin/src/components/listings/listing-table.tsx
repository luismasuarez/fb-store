import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Listing } from "@/types";
import { formatPrice, formatDate } from "@/lib/utils";

interface Props {
  listings: Listing[];
}

export function ListingTable({ listings }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Precio</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Provincia</TableHead>
          <TableHead>Habitaciones</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Scraped</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {listings.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              No listings found
            </TableCell>
          </TableRow>
        ) : (
          listings.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">
                <Link to={`/listings/${l.id}`} className="hover:underline">
                  {l.title || "Sin título"}
                </Link>
              </TableCell>
              <TableCell>{formatPrice(l.price, l.currency)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {l.listingType || "—"}
                </Badge>
              </TableCell>
              <TableCell>{l.province || "—"}</TableCell>
              <TableCell>{l.bedrooms != null ? l.bedrooms : "—"}</TableCell>
              <TableCell>
                <Badge
                  className={
                    l.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }
                >
                  {l.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(l.scrapedAt)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
