export type Category =
  | "casa" | "cocina" | "aseo" | "electronica"
  | "ropa" | "vehiculos" | "muebles" | "otros";

export interface StructuredListing {
  title: string | null;
  price: number | null;
  currency: "Bs" | "USD" | null;
  category: Category | null;
  description: string | null;
  contactPhone: string | null;
  contactName: string | null;
  location: string | null;
  isAvailable: boolean;
  confidence: number;
}

export interface AIProvider {
  readonly name: string;
  extract(rawText: string, imageUrls?: string[]): Promise<StructuredListing>;
}
