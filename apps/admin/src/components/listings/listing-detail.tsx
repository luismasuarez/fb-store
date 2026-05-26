import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Listing } from "@/types";
import { formatPrice, formatDate } from "@/lib/utils";
import { getImageUrl } from "@/lib/api";

interface Props {
  listing?: Listing;
  loading: boolean;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export function ListingDetail({ listing, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Listing no encontrado
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{listing.title || "Sin título"}</h1>
        <p className="text-3xl font-bold text-primary mt-2">
          {formatPrice(listing.price, listing.currency)}
        </p>
        <div className="flex gap-2 mt-2">
          {listing.listingType && (
            <Badge>{listing.listingType}</Badge>
          )}
          {listing.propertyType && (
            <Badge variant="outline">{listing.propertyType}</Badge>
          )}
          <Badge className={listing.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
            {listing.status}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Images */}
      {listing.images && listing.images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {listing.images.map((img, i) => (
            <img
              key={i}
              src={getImageUrl(img)}
              alt={`Imagen ${i + 1}`}
              className="rounded-lg object-cover w-full h-48"
            />
          ))}
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detalles de propiedad</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Tipo" value={listing.propertyType} />
            <Field label="Operación" value={listing.listingType} />
            <Field label="Habitaciones" value={listing.bedrooms} />
            <Field label="Baños" value={listing.bathrooms} />
            <Field label="Metros²" value={listing.totalM2} />
            <Field label="Plantas" value={listing.floors} />
            <Field label="Estacionamiento" value={listing.parking ? "Sí" : listing.parking === false ? "No" : null} />
            <Field label="Amueblado" value={listing.furnished ? "Sí" : listing.furnished === false ? "No" : null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ubicación</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Provincia" value={listing.province} />
            <Field label="Municipio" value={listing.municipality} />
            <Field label="Barrio" value={listing.neighborhood} />
            <Field label="Dirección" value={listing.location} />
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {listing.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{listing.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {listing.summaryShort && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resumen AI</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{listing.summaryShort}</p>
          </CardContent>
        </Card>
      )}

      {/* Contact */}
      {(listing.contactName || listing.contactPhone) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Contacto</CardTitle>
          </CardHeader>
          <CardContent>
            {listing.contactName && <Field label="Nombre" value={listing.contactName} />}
            {listing.contactPhone && <Field label="Teléfono" value={listing.contactPhone} />}
          </CardContent>
        </Card>
      )}

      {/* Meta */}
      <div className="text-xs text-muted-foreground space-y-1">
        <Field label="ID Facebook" value={listing.fbPostId} />
        <Field label="Grupo" value={listing.sourceGroup} />
        <Field label="Scraped" value={formatDate(listing.scrapedAt)} />
        <Field label="Publicado" value={formatDate(listing.postedAt)} />
        <Field label="Procesado" value={formatDate(listing.processedAt)} />
        <Field label="Confianza AI" value={listing.aiConfidence != null ? `${(listing.aiConfidence * 100).toFixed(0)}%` : null} />
      </div>
    </div>
  );
}
