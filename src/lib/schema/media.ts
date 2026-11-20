import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_common";
import { user } from "./auth";

export type MediaVariant = { w: number; format: "avif" | "webp"; file: string };

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: id(),
    /** Путь относительно UPLOAD_DIR без расширения, например `2026/11/<uuid>` */
    path: text("path").notNull().unique(),
    originalName: text("original_name").notNull(),
    mime: varchar("mime", { length: 64 }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    size: integer("size").notNull(),
    blurDataUrl: text("blur_data_url").notNull(),
    variants: jsonb("variants")
      .$type<MediaVariant[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    alt: text("alt").notNull().default(""),
    folder: varchar("folder", { length: 64 }).notNull().default("general"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("media_assets_folder_idx").on(t.folder),
    index("media_assets_created_at_idx").on(t.createdAt),
  ]
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
