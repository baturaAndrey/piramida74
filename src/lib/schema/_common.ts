import { boolean, integer, timestamp, uuid } from "drizzle-orm/pg-core";

// Каждая функция возвращает НОВЫЙ builder — вызывать в каждой таблице отдельно.
export const id = () => uuid("id").primaryKey().defaultRandom();
export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();
export const sortOrder = () => integer("sort_order").notNull().default(0);
export const isActive = () => boolean("is_active").notNull().default(true);
