// Без 'use server': схемы и хелперы общие для формы (клиент) и Server Actions.
import { z } from "zod";

export const LEGAL_DOC_TYPES = ["policy", "consent"] as const;
export type LegalDocTypeValue = (typeof LEGAL_DOC_TYPES)[number];

export const LEGAL_TYPE_LABELS: Record<LegalDocTypeValue, string> = {
  policy: "Политика обработки ПДн",
  consent: "Согласие на обработку ПДн",
};

/** Заголовок по умолчанию для новой версии (совпадает с подписью на сайте) */
export const LEGAL_DEFAULT_TITLES: Record<LegalDocTypeValue, string> = {
  policy: "Политика обработки персональных данных",
  consent: "Согласие на обработку персональных данных",
};

export const MAX_LEGAL_TITLE_LENGTH = 200;
/** Защита от случайной вставки мегабайтов текста; реальные документы — десятки КБ */
export const MAX_LEGAL_BODY_LENGTH = 200_000;

/**
 * Ровно 8 плейсхолдеров, которые подставляет `getCurrentLegalDocument` (src/lib/queries/legal.ts).
 * Других нет — неизвестные остаются в тексте как есть.
 */
export const LEGAL_PLACEHOLDERS = [
  "operator_name",
  "operator_inn",
  "operator_ogrn",
  "operator_address",
  "operator_email",
  "phone",
  "site_url",
  "retention_months",
] as const;
export type LegalPlaceholder = (typeof LEGAL_PLACEHOLDERS)[number];

/** То же выражение, что и в публичной подстановке, — чтобы превью совпадало с сайтом */
const PLACEHOLDER_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;
/** Любые `{{…}}` — для предупреждения о неизвестных/опечатанных плейсхолдерах */
const ANY_PLACEHOLDER_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;
const EMPTY_VALUE = "[не указано]";

export const legalTypeSchema = z.enum(LEGAL_DOC_TYPES);

/** Поля формы (тип и id приходят пропсами, не из полей ввода) */
export const legalFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Введите заголовок")
    .max(MAX_LEGAL_TITLE_LENGTH, `Не длиннее ${MAX_LEGAL_TITLE_LENGTH} символов`),
  body: z
    .string()
    .trim()
    .min(1, "Введите текст документа")
    .max(MAX_LEGAL_BODY_LENGTH, "Слишком длинный текст"),
});
export type LegalFormValues = z.infer<typeof legalFormSchema>;

export const saveLegalDraftSchema = legalFormSchema.extend({
  /** Есть → обновление черновика, нет → создание новой версии */
  id: z.uuid().optional(),
  type: legalTypeSchema,
});

export const legalIdSchema = z.object({ id: z.uuid() });

/** Уникальные `{{…}}`, которых нет среди 8 поддерживаемых плейсхолдеров. */
export function findUnknownPlaceholders(body: string): string[] {
  const known = new Set<string>(LEGAL_PLACEHOLDERS);
  const unknown = new Set<string>();
  for (const match of body.matchAll(ANY_PLACEHOLDER_RE)) {
    const name = match[1] ?? "";
    if (!known.has(name)) unknown.add(match[0]);
  }
  return [...unknown];
}

/** Значения для превью: те же правила, что и на сайте (пустое → «[не указано]»). */
export type LegalPreviewSettings = {
  operator: { name: string; inn: string; ogrn: string; address: string; email: string };
  phone: string;
  leadRetentionMonths: number;
};

export function legalPlaceholderValues(
  settings: LegalPreviewSettings,
  siteUrl: string
): Record<LegalPlaceholder, string> {
  return {
    operator_name: settings.operator.name,
    operator_inn: settings.operator.inn,
    operator_ogrn: settings.operator.ogrn,
    operator_address: settings.operator.address,
    operator_email: settings.operator.email,
    phone: settings.phone,
    site_url: siteUrl.replace(/\/+$/, ""),
    retention_months: String(settings.leadRetentionMonths),
  };
}

/** Подстановка только для предпросмотра; в БД текст хранится с плейсхолдерами как есть. */
export function fillLegalPlaceholders(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER_RE, (match, name: string) => {
    if (!Object.hasOwn(values, name)) return match;
    const value = values[name]?.trim();
    return value ? value : EMPTY_VALUE;
  });
}
