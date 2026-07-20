import type { LucideProps } from "@/lib/icon"
import type { FC } from "react"

export default function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: FC<LucideProps>
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60">{description}</p>
    </div>
  )
}
