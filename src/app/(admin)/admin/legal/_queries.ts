import "server-only";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { legalDocuments } from "@/lib/schema";
import type { LegalDocType } from "@/lib/schema/enums";

export type LegalVersionStatus = "draft" | "current" | "archived";

/** Строка таблицы версий (без тела документа) */
export type LegalVersionRow = {
  id: string;
  type: LegalDocType;
  version: string;
  title: string;
  sha256: string;
  publishedAt: Date | null;
  createdAt: Date;
  status: LegalVersionStatus;
};

export type LegalVersionsByType = Record<LegalDocType, LegalVersionRow[]>;

/**
 * Все версии обоих типов: сначала черновики, затем опубликованные по убыванию `publishedAt`.
 * Текущая — опубликованная с максимальным `publishedAt` (тот же порядок, что
 * у `getCurrentLegalDocument`: `publishedAt desc, createdAt desc`).
 */
export async function getLegalVersions(): Promise<LegalVersionsByType> {
  const rows = await db
    .select({
      id: legalDocuments.id,
      type: legalDocuments.type,
      version: legalDocuments.version,
      title: legalDocuments.title,
      sha256: legalDocuments.sha256,
      publishedAt: legalDocuments.publishedAt,
      createdAt: legalDocuments.createdAt,
    })
    .from(legalDocuments)
    .orderBy(sql`${legalDocuments.publishedAt} desc nulls first`, desc(legalDocuments.createdAt));

  const result: LegalVersionsByType = { policy: [], consent: [] };
  for (const row of rows) {
    const list = result[row.type];
    let status: LegalVersionStatus = "draft";
    if (row.publishedAt) {
      // Первая опубликованная в отсортированном списке типа — текущая
      status = list.some((r) => r.status === "current") ? "archived" : "current";
    }
    list.push({ ...row, status });
  }
  return result;
}

export async function getLegalDocumentById(id: string) {
  const [row] = await db.select().from(legalDocuments).where(eq(legalDocuments.id, id)).limit(1);
  return row ?? null;
}

/** Исходный текст (с плейсхолдерами) текущей версии — заготовка для новой версии. */
export async function getCurrentLegalSource(
  type: LegalDocType
): Promise<{ title: string; body: string } | null> {
  const [row] = await db
    .select({ title: legalDocuments.title, body: legalDocuments.body })
    .from(legalDocuments)
    .where(and(eq(legalDocuments.type, type), isNotNull(legalDocuments.publishedAt)))
    .orderBy(desc(legalDocuments.publishedAt), desc(legalDocuments.createdAt))
    .limit(1);
  return row ?? null;
}
