import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return "Precio no disponible"
  return new Intl.NumberFormat("es-CU", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

export function formatDate(date: string | null): string {
  if (!date) return ""
  return new Intl.DateTimeFormat("es-CU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}
