ALTER TABLE "checks" ADD COLUMN "input_hash" text;--> statement-breakpoint
CREATE INDEX "checks_input_hash_idx" ON "checks" USING btree ("input_hash","created_at");