-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "fb_post_id" TEXT NOT NULL,
    "title" TEXT,
    "price" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'Bs',
    "category" TEXT,
    "description" TEXT,
    "contact_phone" TEXT,
    "contact_name" TEXT,
    "location" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "source_group" TEXT,
    "source_group_id" TEXT,
    "source_url" TEXT,
    "raw_text" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "ai_confidence" DECIMAL(3,2),
    "posted_at" TIMESTAMP(3),
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "max_posts" INTEGER NOT NULL DEFAULT 30,
    "last_scraped" TIMESTAMP(3),
    "last_error" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_logs" (
    "id" UUID NOT NULL,
    "group_id" TEXT NOT NULL,
    "account_index" INTEGER NOT NULL,
    "posts_found" INTEGER NOT NULL DEFAULT 0,
    "posts_new" INTEGER NOT NULL DEFAULT 0,
    "posts_errors" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error" TEXT,

    CONSTRAINT "scrape_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_posts" (
    "id" UUID NOT NULL,
    "fb_post_id" TEXT NOT NULL,
    "group_id" TEXT,
    "raw_data" JSONB,
    "text_content" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "listing_id" UUID,
    "ai_provider" TEXT,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listings_fb_post_id_key" ON "listings"("fb_post_id");

-- CreateIndex
CREATE INDEX "listings_category_idx" ON "listings"("category");

-- CreateIndex
CREATE INDEX "listings_status_idx" ON "listings"("status");

-- CreateIndex
CREATE INDEX "listings_scraped_at_idx" ON "listings"("scraped_at" DESC);

-- CreateIndex
CREATE INDEX "raw_posts_processed_idx" ON "raw_posts"("processed");

-- CreateIndex
CREATE INDEX "raw_posts_fb_post_id_idx" ON "raw_posts"("fb_post_id");

-- AddForeignKey
ALTER TABLE "raw_posts" ADD CONSTRAINT "raw_posts_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
