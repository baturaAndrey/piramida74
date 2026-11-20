import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, isActive, sortOrder, updatedAt } from "./_common";
import { measureUnitEnum, setPricingModeEnum } from "./enums";
import { mediaAssets } from "./media";

/** Общая сетка цен на раздел (Teatone, фирменные чаи, лимонады) */
export const priceGroups = pgTable("price_groups", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const priceGroupTiers = pgTable(
  "price_group_tiers",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => priceGroups.id, { onDelete: "cascade" }),
    /** nanoid 6 символов [0-9a-z]; код позиции калькулятора для сетки = `${menuItems.code}-${code}` */
    code: varchar("code", { length: 8 }).notNull().unique(),
    label: text("label").notNull(), // «Чайник 600 мл»
    amount: numeric("amount", { precision: 8, scale: 2, mode: "number" }),
    unit: measureUnitEnum("unit"),
    price: integer("price").notNull(),
    sortOrder: sortOrder(),
  },
  (t) => [
    index("price_group_tiers_group_idx").on(t.groupId),
    check("price_group_tiers_price_chk", sql`${t.price} >= 0`),
  ]
);

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: id(),
    parentId: uuid("parent_id").references((): AnyPgColumn => menuCategories.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    description: text("description"),
    funFactTitle: text("fun_fact_title"),
    funFactText: text("fun_fact_text"),
    priceGroupId: uuid("price_group_id").references(() => priceGroups.id, { onDelete: "set null" }),
    sortOrder: sortOrder(),
    isActive: isActive(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("menu_categories_parent_idx").on(t.parentId)]
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: id(),
    /** nanoid 6 символов [0-9a-z] — для URL калькулятора */
    code: varchar("code", { length: 8 }).notNull().unique(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    choiceNote: text("choice_note"), // «на выбор: …»
    originCountry: text("origin_country"),
    /** Либо priceGroupId (цены из price_group_tiers), либо >= 1 menu_item_variants. Проверяется в zod/Server Action */
    priceGroupId: uuid("price_group_id").references(() => priceGroups.id, { onDelete: "set null" }),
    imageMediaId: uuid("image_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
    isTakeawayDiscount: boolean("is_takeaway_discount").notNull().default(false),
    sortOrder: sortOrder(),
    isActive: isActive(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("menu_items_category_idx").on(t.categoryId, t.sortOrder)]
);

export const menuItemVariants = pgTable(
  "menu_item_variants",
  {
    id: id(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    label: text("label"),
    amount: numeric("amount", { precision: 8, scale: 2, mode: "number" }),
    unit: measureUnitEnum("unit"),
    price: integer("price").notNull(),
    sortOrder: sortOrder(),
    isActive: isActive(),
  },
  (t) => [
    index("menu_item_variants_item_idx").on(t.itemId),
    check("menu_item_variants_price_chk", sql`${t.price} >= 0`),
  ]
);

/** Платные добавки — в калькулятор не входят, показываются текстом */
export const menuModifiers = pgTable("menu_modifiers", {
  id: id(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  categoryId: uuid("category_id").references(() => menuCategories.id, { onDelete: "set null" }),
  sortOrder: sortOrder(),
  isActive: isActive(),
});

export const banquetSets = pgTable(
  "banquet_sets",
  {
    id: id(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
    pricingMode: setPricingModeEnum("pricing_mode").notNull().default("per_person"),
    price: integer("price").notNull(),
    minGuests: integer("min_guests"),
    maxGuests: integer("max_guests"),
    sortOrder: sortOrder(),
    isActive: isActive(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "banquet_sets_guests_chk",
      sql`${t.minGuests} is null or ${t.maxGuests} is null or ${t.maxGuests} >= ${t.minGuests}`
    ),
  ]
);

export const banquetSetItems = pgTable(
  "banquet_set_items",
  {
    id: id(),
    setId: uuid("set_id")
      .notNull()
      .references(() => banquetSets.id, { onDelete: "cascade" }),
    menuItemVariantId: uuid("menu_item_variant_id").references(() => menuItemVariants.id, {
      onDelete: "set null",
    }),
    customLabel: text("custom_label"), // если нет варианта меню
    qty: integer("qty").notNull().default(1),
    sortOrder: sortOrder(),
  },
  (t) => [
    index("banquet_set_items_set_idx").on(t.setId),
    check("banquet_set_items_qty_chk", sql`${t.qty} > 0`),
  ]
);

export type MenuCategory = typeof menuCategories.$inferSelect;
export type NewMenuCategory = typeof menuCategories.$inferInsert;
export type PriceGroup = typeof priceGroups.$inferSelect;
export type NewPriceGroup = typeof priceGroups.$inferInsert;
export type PriceGroupTier = typeof priceGroupTiers.$inferSelect;
export type NewPriceGroupTier = typeof priceGroupTiers.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
export type MenuItemVariant = typeof menuItemVariants.$inferSelect;
export type NewMenuItemVariant = typeof menuItemVariants.$inferInsert;
export type MenuModifier = typeof menuModifiers.$inferSelect;
export type NewMenuModifier = typeof menuModifiers.$inferInsert;
export type BanquetSet = typeof banquetSets.$inferSelect;
export type NewBanquetSet = typeof banquetSets.$inferInsert;
export type BanquetSetItem = typeof banquetSetItems.$inferSelect;
export type NewBanquetSetItem = typeof banquetSetItems.$inferInsert;
