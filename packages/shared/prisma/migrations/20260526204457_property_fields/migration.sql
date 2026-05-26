-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "ai_raw_data" JSONB,
ADD COLUMN     "bathrooms" DOUBLE PRECISION,
ADD COLUMN     "bedrooms" INTEGER,
ADD COLUMN     "floors" INTEGER,
ADD COLUMN     "furnished" BOOLEAN,
ADD COLUMN     "listing_type" TEXT,
ADD COLUMN     "municipality" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "parking" BOOLEAN,
ADD COLUMN     "property_type" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "summary_short" TEXT,
ADD COLUMN     "total_m2" INTEGER,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "listings_listing_type_idx" ON "listings"("listing_type");

-- CreateIndex
CREATE INDEX "listings_property_type_idx" ON "listings"("property_type");

-- CreateIndex
CREATE INDEX "listings_province_idx" ON "listings"("province");

-- CreateIndex
CREATE INDEX "listings_bedrooms_idx" ON "listings"("bedrooms");
