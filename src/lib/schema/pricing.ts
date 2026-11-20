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
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, isActive, sortOrder, updatedAt } from "./_common";
import { hallKindEnum, penaltyKindEnum, priceUnitEnum, tariffAudienceEnum } from "./enums";

export const halls = pgTable("halls", {
  id: id(),
  name: text("name").notNull(), // «Общий зал», «VIP 1»
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  kind: hallKindEnum("kind").notNull(),
  /** У VIP-комнат = 1 (цена за комнату) */
  tablesCount: integer("tables_count").notNull().default(1),
  seatsPerTable: integer("seats_per_table").notNull().default(4),
  description: text("description"),
  sortOrder: sortOrder(),
  isActive: isActive(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const rentalTariffs = pgTable(
  "rental_tariffs",
  {
    id: id(),
    hallId: uuid("hall_id")
      .notNull()
      .references(() => halls.id, { onDelete: "cascade" }),
    /** 0 = воскресенье … 6 = суббота; день D операционных суток (с 09:00 D до 09:00 D+1) */
    daysOfWeek: smallint("days_of_week").array().notNull(),
    /** Минуты от 09:00 операционных суток: 16:00–02:00 → 420–1020; 02:00–09:00 → 1020–1440 */
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    price: integer("price").notNull(),
    priceUnit: priceUnitEnum("price_unit").notNull().default("per_hour"),
    audience: tariffAudienceEnum("audience").notNull().default("all"),
    label: text("label").notNull(),
    validFrom: date("valid_from", { mode: "string" }),
    validTo: date("valid_to", { mode: "string" }),
    isActive: isActive(),
    sortOrder: sortOrder(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("rental_tariffs_hall_idx").on(t.hallId),
    check(
      "rental_tariffs_window_chk",
      sql`${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.endMin} > ${t.startMin}`
    ),
    check("rental_tariffs_price_chk", sql`${t.price} >= 0`),
  ]
);

/** Нарды/шахматы, прокат кия, тренер. priceUnit: per_hour | per_session (fixed не используется — проверяется в zod) */
export const extraServices = pgTable("extra_services", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  priceUnit: priceUnitEnum("price_unit").notNull().default("per_session"),
  sortOrder: sortOrder(),
  isActive: isActive(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const penaltyItems = pgTable(
  "penalty_items",
  {
    id: id(),
    kind: penaltyKindEnum("kind").notNull(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    priceIsMinimum: boolean("price_is_minimum").notNull().default(false), // «от …»
    sortOrder: sortOrder(),
    isActive: isActive(),
  },
  (t) => [index("penalty_items_kind_idx").on(t.kind, t.sortOrder)]
);

export type Hall = typeof halls.$inferSelect;
export type NewHall = typeof halls.$inferInsert;
export type RentalTariff = typeof rentalTariffs.$inferSelect;
export type NewRentalTariff = typeof rentalTariffs.$inferInsert;
export type ExtraService = typeof extraServices.$inferSelect;
export type NewExtraService = typeof extraServices.$inferInsert;
export type PenaltyItem = typeof penaltyItems.$inferSelect;
export type NewPenaltyItem = typeof penaltyItems.$inferInsert;
