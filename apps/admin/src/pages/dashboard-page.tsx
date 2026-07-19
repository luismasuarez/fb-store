import { useListings } from "@/hooks/use-listings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrapeControls } from "@/components/dashboard/scrape-controls";

export function DashboardPage() {
  const { data: all, isLoading } = useListings({ limit: 1 });
  const { data: sales } = useListings({ listingType: "sale", limit: 1 });
  const { data: rents } = useListings({ listingType: "rent", limit: 1 });
  const { data: havana } = useListings({ province: "La Habana", limit: 1 });

  const cards = [
    { title: "Total listings", value: all?.pagination.total, loading: isLoading },
    { title: "En venta", value: sales?.pagination.total, loading: isLoading },
    { title: "En alquiler", value: rents?.pagination.total, loading: isLoading },
    { title: "La Habana", value: havana?.pagination.total, loading: isLoading },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {card.loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">{card.value ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <ScrapeControls />
    </div>
  );
}
