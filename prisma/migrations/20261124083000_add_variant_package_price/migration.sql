-- Existing installations may already have this optional column from db push.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "packagePrice" INTEGER;
