import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_common";
import { user } from "./auth";

/** Одна строка на ключ SiteSettings; типизация значений — в src/lib/settings-defaults.ts */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(), // «tournament.create», «lead.status»…
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    diff: jsonb("diff")
      .$type<unknown>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entity, t.entityId),
    index("audit_log_created_idx").on(t.createdAt),
  ]
);

export type SiteSetting = typeof siteSettings.$inferSelect;
export type NewSiteSetting = typeof siteSettings.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
