import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  halls,
  legalDocuments,
  leads,
  promotions,
  tournaments,
  type Lead,
  type LeadNotifyStatus,
  type NotifyChannelStatus,
} from "@/lib/schema";
import type { LeadStatus, LeadType, LegalDocType } from "@/lib/schema/enums";
import { buildLeadsWhere, LEADS_PAGE_SIZE, type LeadsSearchParams } from "./_lib/filters";
import { formatLeadListDate, parseQuoteSnapshot, type QuoteSnapshot } from "./_lib/labels";

/** Состояние канала уведомлений для иконки в таблице */
export type NotifyState = "ok" | "error" | "none";

/** Строка списка заявок (сериализуемая — уходит в клиентскую таблицу) */
export type LeadRow = {
  id: string;
  number: number;
  createdAt: string; // ISO
  createdAtLabel: string; // «20 ноя, 14:05» (Екатеринбург)
  type: LeadType;
  status: LeadStatus;
  sourceBlock: string;
  name: string | null;
  phone: string | null;
  guests: number | null;
  quoteTotal: number | null;
  anonymized: boolean;
  notify: { email: NotifyState; telegram: NotifyState };
};

export type LeadsListResult = { rows: LeadRow[]; total: number; page: number; pageCount: number };

function notifyState(channel: NotifyChannelStatus | undefined): NotifyState {
  if (!channel) return "none";
  return channel.ok ? "ok" : "error";
}

export function toNotifyStates(status: LeadNotifyStatus): LeadRow["notify"] {
  return { email: notifyState(status.email), telegram: notifyState(status.telegram) };
}

/** Страница списка: 50 строк, `createdAt desc`, общее число по тем же фильтрам */
export async function listLeads(params: LeadsSearchParams, page: number): Promise<LeadsListResult> {
  const where = buildLeadsWhere(params);
  const [totalRows] = await db.select({ value: count() }).from(leads).where(where);
  const total = totalRows?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  // Страница за пределами диапазона показывает последнюю, а не пустую таблицу
  const safePage = Math.min(page, pageCount);

  const rows = await db
    .select({
      id: leads.id,
      number: leads.number,
      createdAt: leads.createdAt,
      type: leads.type,
      status: leads.status,
      sourceBlock: leads.sourceBlock,
      name: leads.name,
      phone: leads.phone,
      guests: leads.guests,
      quoteTotal: leads.quoteTotal,
      anonymizedAt: leads.anonymizedAt,
      notifyStatus: leads.notifyStatus,
    })
    .from(leads)
    .where(where)
    .orderBy(desc(leads.createdAt), desc(leads.number))
    .limit(LEADS_PAGE_SIZE)
    .offset((safePage - 1) * LEADS_PAGE_SIZE);

  return {
    total,
    page: safePage,
    pageCount,
    rows: rows.map((row) => ({
      id: row.id,
      number: row.number,
      createdAt: row.createdAt.toISOString(),
      createdAtLabel: formatLeadListDate(row.createdAt),
      type: row.type,
      status: row.status,
      sourceBlock: row.sourceBlock,
      name: row.name,
      phone: row.phone,
      guests: row.guests,
      quoteTotal: row.quoteTotal,
      anonymized: row.anonymizedAt !== null,
      notify: toNotifyStates(row.notifyStatus),
    })),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LeadDetail = Lead & {
  promotionTitle: string | null;
  tournamentTitle: string | null;
  consentDocument: { id: string; type: LegalDocType; version: string; title: string } | null;
  /** Разобранный quoteSnapshot (null — нет или некорректный) */
  snapshot: QuoteSnapshot | null;
  /** Зал расчёта: из снимка, иначе по hallId из таблицы halls; null — неизвестен */
  hallName: string | null;
};

/** Название зала расчёта: сохранённое в снимке или текущее по hallId */
export async function resolveHallName(snapshot: QuoteSnapshot | null): Promise<string | null> {
  if (!snapshot) return null;
  if (snapshot.hallName) return snapshot.hallName;
  const hallId = snapshot.input?.hallId;
  if (!hallId || !UUID_RE.test(hallId)) return null;
  const [hall] = await db
    .select({ name: halls.name })
    .from(halls)
    .where(eq(halls.id, hallId))
    .limit(1);
  return hall?.name ?? null;
}

/** Заявка с названиями акции/турнира и версией документа согласия; null — нет такой (или id не uuid) */
export async function getLead(id: string): Promise<LeadDetail | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select({
      lead: leads,
      promotionTitle: promotions.title,
      tournamentTitle: tournaments.title,
      consentId: legalDocuments.id,
      consentType: legalDocuments.type,
      consentVersion: legalDocuments.version,
      consentTitle: legalDocuments.title,
    })
    .from(leads)
    .leftJoin(promotions, eq(promotions.id, leads.promotionId))
    .leftJoin(tournaments, eq(tournaments.id, leads.tournamentId))
    .leftJoin(legalDocuments, eq(legalDocuments.id, leads.consentDocumentId))
    .where(eq(leads.id, id))
    .limit(1);
  if (!row) return null;

  const consentDocument =
    row.consentId && row.consentType && row.consentVersion !== null
      ? {
          id: row.consentId,
          type: row.consentType,
          version: row.consentVersion,
          title: row.consentTitle ?? "",
        }
      : null;

  const snapshot = parseQuoteSnapshot(row.lead.quoteSnapshot);
  return {
    ...row.lead,
    snapshot,
    hallName: await resolveHallName(snapshot),
    promotionTitle: row.promotionTitle,
    tournamentTitle: row.tournamentTitle,
    consentDocument,
  };
}
