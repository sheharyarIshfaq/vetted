CREATE TABLE "brand_aliases" (
	"alias" text PRIMARY KEY NOT NULL,
	"brand_norm" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"input" jsonb NOT NULL,
	"extracted" jsonb,
	"candidates" jsonb,
	"verdict" text,
	"recall_id" text,
	"evidence" jsonb,
	"label" jsonb,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_note" text,
	CONSTRAINT "checks_verdict_check" CHECK ("checks"."verdict" in ('recalled', 'check_label', 'clear'))
);
--> statement-breakpoint
CREATE TABLE "parse_cache" (
	"input_hash" text PRIMARY KEY NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recalls" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_ref" text NOT NULL,
	"url" text NOT NULL,
	"published_at" date NOT NULL,
	"category" text,
	"subcategory" text,
	"brand" text,
	"brand_norm" text,
	"product_name" text NOT NULL,
	"models" text[] DEFAULT '{}' NOT NULL,
	"refs" text[] DEFAULT '{}' NOT NULL,
	"gtins" text[] DEFAULT '{}' NOT NULL,
	"batches" text[] DEFAULT '{}' NOT NULL,
	"production_from" date,
	"production_to" date,
	"model_ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sold_from" date,
	"sold_to" date,
	"risk" text,
	"reason" text,
	"what_to_do" text,
	"images" text[] DEFAULT '{}' NOT NULL,
	"dates_quote" text,
	"raw" jsonb NOT NULL,
	"search_text" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recalls_source_check" CHECK ("recalls"."source" in ('rappelconso', 'safetygate'))
);
--> statement-breakpoint
CREATE TABLE "watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"brand_norm" text,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_recall_id_recalls_id_fk" FOREIGN KEY ("recall_id") REFERENCES "public"."recalls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recalls_search_trgm" ON "recalls" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "recalls_brand_trgm" ON "recalls" USING gin ("brand_norm" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "recalls_gtins" ON "recalls" USING gin ("gtins");--> statement-breakpoint
CREATE INDEX "recalls_published" ON "recalls" USING btree ("published_at" DESC NULLS LAST);