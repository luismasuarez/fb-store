import { useLocation } from "@/lib/use-location"
import ListingTable from "./ListingTable"
import ListingDetailPage from "./ListingDetailPage"

export default function ListingsRouter() {
  const location = useLocation()

  const idParam = new URLSearchParams(location.split("?")[1] ?? "").get("id")
  if (idParam) {
    return <ListingDetailPage id={idParam} />
  }

  return <ListingTable />
}
