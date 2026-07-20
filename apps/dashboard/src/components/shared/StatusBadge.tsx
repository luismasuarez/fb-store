import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const variants: Record<string, string> = {
  alive: "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20",
  dead: "bg-red-500/15 text-red-500 hover:bg-red-500/20",
  locked: "bg-orange-500/15 text-orange-500 hover:bg-orange-500/20",
  unknown: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20",
  inactive: "bg-muted text-muted-foreground",
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-normal capitalize", variants[status] ?? variants.unknown)}
    >
      {status}
    </Badge>
  )
}
