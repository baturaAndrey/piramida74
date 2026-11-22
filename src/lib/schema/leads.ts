import { sql } from "drizzle-orm";
import {
  char,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_common";
import { promotions, tournaments } from "./club";
import { callbackWindowEnum, leadStatusEnum, leadTypeEnum, legalDocTypeEnum } from "./enums";

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: id(),
    type: legalDocTypeEnum("type").notNull(),
    version: varchar("version", { length: 32 }).notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull(), // markdown (с плейсхолдерами)
    sha256: char("sha256", { length: 64 }).notNull(),
    /** null = черновик (правит админка, задача 19); текущая версия — максимальный НЕ null publishedAt */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("legal_documents_type_version_uq").on(t.type, t.version),
    index("legal_documents_type_pub_idx").on(t.type, t.publishedAt),
  ]
);

export type NotifyChannelStatus = { ok: boolean; error?: string; at: string };
export type LeadNotifyStatus = { email?: NotifyChannelStatus; telegram?: NotifyChannelStatus };

export const leads = pgTable(
  "leads",
  {
    id: id(),
    /** «Заявка #N» */
    number: integer("number").notNull().generatedAlwaysAsIdentity(),
    type: leadTypeEnum("type").notNull(),
    status: leadStatusEnum("status").notNull().default("new"),
    sourceBlock: text("source_block").notNull(), // «Шапка сайта», «Первый экран»…
    formTitle: text("form_title").notNull(),
    pageUrl: text("page_url").notNull(),
    name: varchar("name", { length: 120 }),
    phone: varchar("phone", { length: 32 }),
    callbackWindow: callbackWindowEnum("callback_window"),
    preferredDate: date("preferred_date", { mode: "string" }),
    preferredTime: varchar("preferred_time", { length: 5 }),
    guests: integer("guests"),
    comment: text("comment"),
    promotionId: uuid("promotion_id").references(() => promotions.id, { onDelete: "set null" }),
    tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "set null" }),
    /** Пересчитанный на сервере расчёт калькулятора (QuoteInput + Quote) */
    quoteSnapshot: jsonb("quote_snapshot").$type<Record<string, unknown>>(),
    quoteTotal: integer("quote_total"),
    // restrict: опубликованные версии документа неизменяемы и не удаляются, пока на них ссылаются заявки
    consentDocumentId: uuid("consent_document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "restrict" }),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    /** sha256(ip + BETTER_AUTH_SECRET); nullable — обнуляется cron'ом обезличивания */
    ipHash: char("ip_hash", { length: 64 }),
    userAgent: text("user_agent").notNull().default(""),
    notifyStatus: jsonb("notify_status")
      .$type<LeadNotifyStatus>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** Дата обезличивания (name/phone/comment/ipHash → null, userAgent → '') по сроку хранения */
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("leads_number_uq").on(t.number),
    index("leads_status_created_idx").on(t.status, t.createdAt),
    index("leads_created_idx").on(t.createdAt),
    index("leads_type_idx").on(t.type),
  ]
);

export type LegalDocument = typeof legalDocuments.$inferSelect;
export type NewLegalDocument = typeof legalDocuments.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
