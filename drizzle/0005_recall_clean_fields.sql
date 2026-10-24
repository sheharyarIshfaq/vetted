ALTER TABLE "recalls" ADD COLUMN "brand_clean" text;--> statement-breakpoint
ALTER TABLE "recalls" ADD COLUMN "brand_clean_norm" text;--> statement-breakpoint
ALTER TABLE "recalls" ADD COLUMN "product_type" text;--> statement-breakpoint
ALTER TABLE "recalls" ADD COLUMN "model_name" text;--> statement-breakpoint
ALTER TABLE "recalls" ADD COLUMN "codes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "recalls" ADD COLUMN "specs" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "recalls" ADD COLUMN "clean_hash" text;