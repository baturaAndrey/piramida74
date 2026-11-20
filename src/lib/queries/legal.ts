import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { legalDocuments } from "@/lib/schema";
import type { LegalDocType } from "@/lib/schema/enums";
import type { SiteSettings } from "@/lib/settings-defaults";
import { getSettings } from "./settings";

export type PublicLegalDocument = {
  id: string;
  type: LegalDocType;
  /** varchar(32) */
  version: string;
  title: string;
  /** markdown с уже подставленными плейсхолдерами */
  text: string;
  /** ISO-строка */
  publishedAt: string;
  sha256: string;
};

/** Видимая пометка вместо пустого реквизита — чтобы пробел в документе не остался незамеченным */
const EMPTY_VALUE = "[не указано]";

const DEFAULT_TITLES: Record<LegalDocType, string> = {
  policy: "Политика обработки персональных данных",
  consent: "Согласие на обработку персональных данных",
};

const PLACEHOLDER_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Значения 8 плейсхолдеров (полный список — contracts.md, других нет). */
function placeholderValues(settings: SiteSettings): Record<string, string> {
  return {
    operator_name: settings.operator.name,
    operator_inn: settings.operator.inn,
    operator_ogrn: settings.operator.ogrn,
    operator_address: settings.operator.address,
    operator_email: settings.operator.email,
    phone: settings.phone,
    site_url: (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, ""),
    retention_months: String(settings.leadRetentionMonths),
  };
}

/**
 * Подстановка плейсхолдеров `{{name}}`. Пустое значение → «[не указано]»;
 * неизвестный плейсхолдер остаётся как есть (видно при вычитке).
 */
function fillPlaceholders(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER_RE, (match, name: string) => {
    if (!Object.hasOwn(values, name)) return match;
    const value = values[name]?.trim();
    return value ? value : EMPTY_VALUE;
  });
}

/**
 * Текущая (последняя по `publishedAt`, без черновиков) версия юридического документа
 * с подставленными плейсхолдерами; `null`, если опубликованных версий нет.
 * Единственное место подстановки плейсхолдеров в проекте — потребители рендерят `text` как есть.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getCurrentLegalDocument(
  type: LegalDocType
): Promise<PublicLegalDocument | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.legal, TAGS.settings);
  const [[doc], settings] = await Promise.all([
    db
      .select({
        id: legalDocuments.id,
        type: legalDocuments.type,
        version: legalDocuments.version,
        title: legalDocuments.title,
        body: legalDocuments.body,
        publishedAt: legalDocuments.publishedAt,
        sha256: legalDocuments.sha256,
      })
      .from(legalDocuments)
      .where(and(eq(legalDocuments.type, type), isNotNull(legalDocuments.publishedAt)))
      .orderBy(desc(legalDocuments.publishedAt), desc(legalDocuments.createdAt))
      .limit(1),
    getSettings(),
  ]);
  if (!doc || !doc.publishedAt) return null;
  return {
    id: doc.id,
    type: doc.type,
    version: doc.version,
    title: doc.title.trim() || DEFAULT_TITLES[doc.type],
    text: fillPlaceholders(doc.body, placeholderValues(settings)),
    publishedAt: doc.publishedAt.toISOString(),
    sha256: doc.sha256,
  };
}
