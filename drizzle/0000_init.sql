CREATE TYPE "public"."article_status" AS ENUM('draft', 'scheduled', 'published');--> statement-breakpoint
CREATE TYPE "public"."callback_window" AS ENUM('now', 'hour', 'day', 'week');--> statement-breakpoint
CREATE TYPE "public"."discipline" AS ENUM('free_pyramid', 'combined_pyramid', 'dynamic_pyramid', 'moscow_pyramid', 'free_pyramid_continuation', 'pool', 'other');--> statement-breakpoint
CREATE TYPE "public"."hall_kind" AS ENUM('common', 'vip');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'in_progress', 'done', 'spam');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('callback', 'booking', 'promo', 'calculator', 'tournament');--> statement-breakpoint
CREATE TYPE "public"."legal_doc_type" AS ENUM('policy', 'consent');--> statement-breakpoint
CREATE TYPE "public"."measure_unit" AS ENUM('g', 'ml', 'l', 'pcs');--> statement-breakpoint
CREATE TYPE "public"."penalty_kind" AS ENUM('dishware', 'property');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('per_hour', 'fixed', 'per_session');--> statement-breakpoint
CREATE TYPE "public"."promotion_target" AS ENUM('table_rental', 'menu_category', 'takeaway', 'other');--> statement-breakpoint
CREATE TYPE "public"."set_pricing_mode" AS ENUM('per_person', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."tariff_audience" AS ENUM('all', 'pensioner');--> statement-breakpoint
CREATE TYPE "public"."tournament_level" AS ENUM('regional_championship', 'regional_youth', 'club', 'other');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"two_factor_enabled" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"original_name" text NOT NULL,
	"mime" varchar(64) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size" integer NOT NULL,
	"blur_data_url" text NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"folder" varchar(64) DEFAULT 'general' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "banquet_set_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"menu_item_variant_id" uuid,
	"custom_label" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "banquet_set_items_qty_chk" CHECK ("banquet_set_items"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "banquet_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(8) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_media_id" uuid,
	"pricing_mode" "set_pricing_mode" DEFAULT 'per_person' NOT NULL,
	"price" integer NOT NULL,
	"min_guests" integer,
	"max_guests" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "banquet_sets_code_unique" UNIQUE("code"),
	CONSTRAINT "banquet_sets_guests_chk" CHECK ("banquet_sets"."min_guests" is null or "banquet_sets"."max_guests" is null or "banquet_sets"."max_guests" >= "banquet_sets"."min_guests")
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"title" text NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"fun_fact_title" text,
	"fun_fact_text" text,
	"price_group_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "menu_item_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(8) NOT NULL,
	"item_id" uuid NOT NULL,
	"label" text,
	"amount" numeric(8, 2),
	"unit" "measure_unit",
	"price" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "menu_item_variants_code_unique" UNIQUE("code"),
	CONSTRAINT "menu_item_variants_price_chk" CHECK ("menu_item_variants"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(8) NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"choice_note" text,
	"origin_country" text,
	"price_group_id" uuid,
	"image_media_id" uuid,
	"is_takeaway_discount" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_items_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "menu_modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"category_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_group_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"code" varchar(8) NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(8, 2),
	"unit" "measure_unit",
	"price" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "price_group_tiers_code_unique" UNIQUE("code"),
	CONSTRAINT "price_group_tiers_price_chk" CHECK ("price_group_tiers"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "price_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "galleries_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"caption" text,
	"variant" varchar(16) DEFAULT 'default' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" varchar(160) NOT NULL,
	"short_text" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_media_id" uuid,
	"discount_percent" integer,
	"days_of_week" smallint[],
	"start_min" integer,
	"end_min" integer,
	"target" "promotion_target" DEFAULT 'other' NOT NULL,
	"target_menu_category_id" uuid,
	"audience_note" text,
	"valid_from" date,
	"valid_to" date,
	"show_in_carousel" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "promotions_window_chk" CHECK (("promotions"."start_min" is null and "promotions"."end_min" is null) or ("promotions"."start_min" >= 0 and "promotions"."end_min" <= 1440 and "promotions"."end_min" > "promotions"."start_min")),
	CONSTRAINT "promotions_discount_chk" CHECK ("promotions"."discount_percent" is null or ("promotions"."discount_percent" between 1 and 100))
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"bullets" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_from" integer,
	"price_from_hall_kind" "hall_kind",
	"price_note" text,
	"cta_block" text DEFAULT 'Бронирование' NOT NULL,
	"cta_type" varchar(16) DEFAULT 'booking' NOT NULL,
	"gallery_key" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tournament_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" varchar(160) NOT NULL,
	"series_id" uuid,
	"stage_number" integer,
	"discipline" "discipline",
	"level" "tournament_level" DEFAULT 'other' NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"entry_fee" integer,
	"prize_fund" integer,
	"description" text,
	"cover_media_id" uuid,
	"registration_open" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tournaments_dates_chk" CHECK ("tournaments"."end_date" >= "tournaments"."start_date")
);
--> statement-breakpoint
CREATE TABLE "extra_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"price_unit" "price_unit" DEFAULT 'per_session' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "halls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(64) NOT NULL,
	"kind" "hall_kind" NOT NULL,
	"tables_count" integer DEFAULT 1 NOT NULL,
	"seats_per_table" integer DEFAULT 4 NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "halls_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "penalty_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "penalty_kind" NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"price_is_minimum" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hall_id" uuid NOT NULL,
	"days_of_week" smallint[] NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"price" integer NOT NULL,
	"price_unit" "price_unit" DEFAULT 'per_hour' NOT NULL,
	"audience" "tariff_audience" DEFAULT 'all' NOT NULL,
	"label" text NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_tariffs_window_chk" CHECK ("rental_tariffs"."start_min" >= 0 and "rental_tariffs"."end_min" <= 1440 and "rental_tariffs"."end_min" > "rental_tariffs"."start_min"),
	CONSTRAINT "rental_tariffs_price_chk" CHECK ("rental_tariffs"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "leads_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "lead_type" NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"source_block" text NOT NULL,
	"form_title" text NOT NULL,
	"page_url" text NOT NULL,
	"name" varchar(120),
	"phone" varchar(32),
	"callback_window" "callback_window",
	"preferred_date" date,
	"preferred_time" varchar(5),
	"guests" integer,
	"comment" text,
	"promotion_id" uuid,
	"tournament_id" uuid,
	"quote_snapshot" jsonb,
	"quote_total" integer,
	"consent_document_id" uuid NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"ip_hash" char(64),
	"user_agent" text DEFAULT '' NOT NULL,
	"notify_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_number_uq" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "legal_doc_type" NOT NULL,
	"version" varchar(32) NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"sha256" char(64) NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_documents_type_version_uq" UNIQUE("type","version")
);
--> statement-breakpoint
CREATE TABLE "article_tags" (
	"article_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "article_tags_article_id_tag_id_pk" PRIMARY KEY("article_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"cover_media_id" uuid,
	"author_id" uuid,
	"rubric_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL,
	"show_toc" boolean DEFAULT true NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"reading_minutes" integer DEFAULT 1 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"noindex" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" text NOT NULL,
	"photo_media_id" uuid,
	"role_in_club" text,
	"rank" text,
	"bio" text,
	"same_as" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "blog_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"code" smallint DEFAULT 301 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redirects_from_path_unique" UNIQUE("from_path"),
	CONSTRAINT "redirects_code_chk" CHECK ("redirects"."code" in (301, 302, 307, 308))
);
--> statement-breakpoint
CREATE TABLE "rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_media_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rubrics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banquet_set_items" ADD CONSTRAINT "banquet_set_items_set_id_banquet_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."banquet_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banquet_set_items" ADD CONSTRAINT "banquet_set_items_menu_item_variant_id_menu_item_variants_id_fk" FOREIGN KEY ("menu_item_variant_id") REFERENCES "public"."menu_item_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banquet_sets" ADD CONSTRAINT "banquet_sets_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_parent_id_menu_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menu_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_price_group_id_price_groups_id_fk" FOREIGN KEY ("price_group_id") REFERENCES "public"."price_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_variants" ADD CONSTRAINT "menu_item_variants_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_price_group_id_price_groups_id_fk" FOREIGN KEY ("price_group_id") REFERENCES "public"."price_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_image_media_id_media_assets_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_modifiers" ADD CONSTRAINT "menu_modifiers_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_group_tiers" ADD CONSTRAINT "price_group_tiers_group_id_price_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."price_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_target_menu_category_id_menu_categories_id_fk" FOREIGN KEY ("target_menu_category_id") REFERENCES "public"."menu_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_series_id_tournament_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."tournament_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_tariffs" ADD CONSTRAINT "rental_tariffs_hall_id_halls_id_fk" FOREIGN KEY ("hall_id") REFERENCES "public"."halls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_consent_document_id_legal_documents_id_fk" FOREIGN KEY ("consent_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tag_id_blog_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."blog_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_rubric_id_rubrics_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors" ADD CONSTRAINT "authors_photo_media_id_media_assets_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_image_media_id_media_assets_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "media_assets_folder_idx" ON "media_assets" USING btree ("folder");--> statement-breakpoint
CREATE INDEX "media_assets_created_at_idx" ON "media_assets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "banquet_set_items_set_idx" ON "banquet_set_items" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "menu_categories_parent_idx" ON "menu_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "menu_item_variants_item_idx" ON "menu_item_variants" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "menu_items_category_idx" ON "menu_items" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE INDEX "price_group_tiers_group_idx" ON "price_group_tiers" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "gallery_items_gallery_idx" ON "gallery_items" USING btree ("gallery_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "gallery_items_unique_idx" ON "gallery_items" USING btree ("gallery_id","media_id","variant");--> statement-breakpoint
CREATE INDEX "tournaments_end_date_idx" ON "tournaments" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "tournaments_series_idx" ON "tournaments" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "penalty_items_kind_idx" ON "penalty_items" USING btree ("kind","sort_order");--> statement-breakpoint
CREATE INDEX "rental_tariffs_hall_idx" ON "rental_tariffs" USING btree ("hall_id");--> statement-breakpoint
CREATE INDEX "leads_status_created_idx" ON "leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_type_idx" ON "leads" USING btree ("type");--> statement-breakpoint
CREATE INDEX "legal_documents_type_pub_idx" ON "legal_documents" USING btree ("type","published_at");--> statement-breakpoint
CREATE INDEX "article_tags_tag_idx" ON "article_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "articles_status_published_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "articles_rubric_idx" ON "articles" USING btree ("rubric_id");--> statement-breakpoint
CREATE INDEX "articles_author_idx" ON "articles" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");