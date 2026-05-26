export type ListingType = "sale" | "rent" | "swap" | "unknown";
export type PropertyType = "apartment" | "house" | "room" | "land" | "commercial" | "unknown";

export interface PropertyPrice {
  amount: number | null;
  currency: "USD" | "MLC" | "CUP" | "Bs" | null;
  rawText: string | null;
  mentioned: boolean;
}

export interface PropertyLocation {
  country: string;
  province: string | null;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  references: string[];
}

export interface PropertyDetails {
  totalM2: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: boolean | null;
  furnished: boolean | null;
  constructionAge: string | null;
  propertyCondition: string | null;
}

export interface PropertyServices {
  water: boolean | null;
  hotWater: boolean | null;
  electricity: boolean | null;
  internet: boolean | null;
  gas: boolean | null;
}

export interface PropertyContact {
  phones: string[];
  whatsapp: string[];
  facebookName: string | null;
  preferredContactMethod: string | null;
}

export interface PropertyMedia {
  imageCount: number;
  imageUrls: string[];
}

export interface RawEntities {
  possiblePrices: string[];
  possibleAddresses: string[];
  possiblePhoneNumbers: string[];
}

export interface StructuredPropertyListing {
  listingType: ListingType;
  propertyType: PropertyType;
  title: string | null;
  descriptionClean: string | null;
  summaryShort: string | null;
  price: PropertyPrice;
  location: PropertyLocation;
  propertyDetails: PropertyDetails;
  features: string[];
  includedItems: string[];
  services: PropertyServices;
  securityFeatures: string[];
  contact: PropertyContact;
  media: PropertyMedia;
  sellerNotes: string[];
  missingInformation: string[];
  confidenceScore: number;
  rawEntitiesDetected: RawEntities;
}

export interface AIProvider {
  readonly name: string;
  extract(rawText: string, imageUrls?: string[]): Promise<StructuredPropertyListing>;
}
