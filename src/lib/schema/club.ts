import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, isActive, sortOrder, updatedAt } from "./_common";
import { disciplineEnum, hallKindEnum, promotionTargetEnum, tournamentLevelEnum } from "./enums";
import { mediaAssets } from "./media";
import { menuCategories } from "./menu";

export const tournamentSeries = pgTable("tournament_series", {
  id: id(),
  name: text("name").notNull(), // «Марафон-Промнефтегаз», «Сеньоры Челябинска»
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  description: text("description"),
  sortOrder: sortOrder(),
  isActive: isActive(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const tournaments = pgTable(
  "tournaments",
  {
    id: id(),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    seriesId: uuid("series_id").references(() => tournamentSeries.id, { onDelete: "set null" }),
    stageNumber: integer("stage_number"),
    discipline: disciplineEnum("discipline"),
    level: tournamentLevelEnum("level").notNull().default("other"),
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    startDate: date("start_date", { mode: "string" }).notNull(),
    /** = startDate для однодневных. Фильтр «предстоящие»: endDate >= сегодня (Екатеринбург) */
    endDate: date("end_date", { mode: "string" }).notNull(),
    entryFee: integer("entry_fee"), // ₽
    prizeFund: integer("prize_fund"), // ₽
    description: text("description"),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
    registrationOpen: boolean("registration_open").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tournaments_end_date_idx").on(t.endDate),
    index("tournaments_series_idx").on(t.seriesId),
    check("tournaments_dates_chk", sql`${t.endDate} >= ${t.startDate}`),
  ]
);

export const promotions = pgTable(
  "promotions",
  {
    id: id(),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    shortText: text("short_text").notNull(),
    description: text("description").notNull().default(""), // markdown
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
    discountPercent: integer("discount_percent"),
    /** День D операционных суток: 0 = вс … 6 = сб; null = каждый день */
    daysOfWeek: smallint("days_of_week").array(),
    /** Минуты от 09:00 операционных суток (0..1440), как у тарифов */
    startMin: integer("start_min"),
    endMin: integer("end_min"),
    target: promotionTargetEnum("target").notNull().default("other"),
    targetMenuCategoryId: uuid("target_menu_category_id").references(() => menuCategories.id, {
      onDelete: "set null",
    }),
    audienceNote: text("audience_note"),
    validFrom: date("valid_from", { mode: "string" }),
    validTo: date("valid_to", { mode: "string" }),
    showInCarousel: boolean("show_in_carousel").notNull().default(true),
    isActive: isActive(),
    sortOrder: sortOrder(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "promotions_window_chk",
      sql`(${t.startMin} is null and ${t.endMin} is null) or (${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.endMin} > ${t.startMin})`
    ),
    check(
      "promotions_discount_chk",
      sql`${t.discountPercent} is null or (${t.discountPercent} between 1 and 100)`
    ),
  ]
);

/** 4 вкладки «Услуги»: key = russian | american | vip | training */
export const services = pgTable("services", {
  id: id(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  bullets: text("bullets").array().notNull().default(sql`'{}'::text[]`),
  /** Ручная цена «от …»; если null и задан priceFromHallKind — считается из rental_tariffs */
  priceFrom: integer("price_from"),
  priceFromHallKind: hallKindEnum("price_from_hall_kind"),
  priceNote: text("price_note"), // «/час», «Тренер + стол»
  /** Значение block для попапа брони, например «Русский бильярд» */
  ctaBlock: text("cta_block").notNull().default("Бронирование"),
  /** Тип кнопки вкладки: "booking" (попап брони) | "callback" (обратный звонок); проверяется zod в админке */
  ctaType: varchar("cta_type", { length: 16 }).notNull().default("booking"),
  /** key галереи (galleries.key) с фото вкладки: service_russian | service_pool | service_vip | service_training */
  galleryKey: text("gallery_key"),
  sortOrder: sortOrder(),
  isActive: isActive(),
  updatedAt: updatedAt(),
});

/** key (text, не enum): seed создаёт hero | service_russian | service_pool | service_vip | service_training | bar | about | cta; админка может добавлять другие */
export const galleries = pgTable("galleries", {
  id: id(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  updatedAt: updatedAt(),
});

export const galleryItems = pgTable(
  "gallery_items",
  {
    id: id(),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    caption: text("caption"),
    /** 'default' | 'mobile' — hero имеет отдельное мобильное изображение */
    variant: varchar("variant", { length: 16 }).notNull().default("default"),
    sortOrder: sortOrder(),
  },
  (t) => [
    index("gallery_items_gallery_idx").on(t.galleryId, t.sortOrder),
    uniqueIndex("gallery_items_unique_idx").on(t.galleryId, t.mediaId, t.variant),
  ]
);

export type TournamentSeries = typeof tournamentSeries.$inferSelect;
export type NewTournamentSeries = typeof tournamentSeries.$inferInsert;
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type Promotion = typeof promotions.$inferSelect;
export type NewPromotion = typeof promotions.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type Gallery = typeof galleries.$inferSelect;
export type NewGallery = typeof galleries.$inferInsert;
export type GalleryItem = typeof galleryItems.$inferSelect;
export type NewGalleryItem = typeof galleryItems.$inferInsert;
