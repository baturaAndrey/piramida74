// Разбор фильтров списка заявок. Общий для страницы /admin/leads и CSV-экспорта.
import { and, eq, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import { parseLocalDateTime } from "@/lib/dates";
import { leads } from "@/lib/schema";
import { isLeadStatus, isLeadType, type LeadsFilterValues } from "./labels";

export type LeadsSearchParams = Record<string, string | string[] | undefined>;

export const LEADS_PAGE_SIZE = 50;
/** Длиннее поисковая строка не нужна; защищает от тяжёлых ILIKE-шаблонов */
const MAX_QUERY_LENGTH = 100;
const MAX_INT32 = 2_147_483_647;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Первое значение параметра (`?a=1&a=2` → "1") */
export function firstParam(params: LeadsSearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** `%`, `_` и `\` в поисковой строке — обычные символы, а не шаблоны LIKE */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Проверенная календарная дата `YYYY-MM-DD` или null (отбрасывает 2026-02-31 и мусор) */
export function parseIsoDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = ISO_DATE_RE.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  const valid =
    probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
  return valid ? value : null;
}

/** Следующий календарный день для `YYYY-MM-DD` (входная дата уже проверена) */
function nextIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

function searchCondition(rawQuery: string | undefined): SQL | undefined {
  const query = rawQuery?.trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) return undefined;

  const pattern = `%${escapeLike(query)}%`;
  const textMatch = or(ilike(leads.name, pattern), ilike(leads.phone, pattern));

  // Целое (можно с «#») — точный номер заявки; телефон по цифрам тоже ищем,
  // иначе фрагмент номера телефона без «+» ничего бы не нашёл.
  const numberMatch = /^#?(\d{1,10})$/.exec(query);
  if (numberMatch) {
    const value = Number(numberMatch[1]);
    const digitsPattern = `%${numberMatch[1]}%`;
    if (value <= MAX_INT32) {
      return or(eq(leads.number, value), ilike(leads.phone, digitsPattern));
    }
    return ilike(leads.phone, digitsPattern);
  }
  return textMatch;
}

/**
 * Условие WHERE по `status`, `type`, `q`, `from`, `to`.
 * Некорректные значения игнорируются (фильтр не применяется), а не дают ошибку.
 * Даты — календарные дни в зоне Екатеринбурга: `from` включительно с 00:00, `to` включительно
 * (граница — 00:00 следующего дня, не включая).
 */
export function buildLeadsWhere(params: LeadsSearchParams): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];

  const status = firstParam(params, "status");
  if (isLeadStatus(status)) conditions.push(eq(leads.status, status));

  const type = firstParam(params, "type");
  if (isLeadType(type)) conditions.push(eq(leads.type, type));

  conditions.push(searchCondition(firstParam(params, "q")));

  const from = parseIsoDate(firstParam(params, "from"));
  if (from) conditions.push(gte(leads.createdAt, parseLocalDateTime(`${from}T00:00`)));

  const to = parseIsoDate(firstParam(params, "to"));
  if (to) conditions.push(lt(leads.createdAt, parseLocalDateTime(`${nextIsoDate(to)}T00:00`)));

  const defined = conditions.filter((c): c is SQL => c !== undefined);
  return defined.length > 0 ? and(...defined) : undefined;
}

/** Номер страницы (с 1); мусор и значения < 1 → 1 */
export function parseLeadsPage(params: LeadsSearchParams): number {
  const raw = firstParam(params, "page");
  const page = raw && /^\d{1,6}$/.test(raw) ? Number(raw) : 1;
  return page >= 1 ? page : 1;
}

/** Текущие значения фильтров для формы и ссылок; некорректные значения сбрасываются в "" */
export function getLeadsFilterValues(params: LeadsSearchParams): LeadsFilterValues {
  const status = firstParam(params, "status");
  const type = firstParam(params, "type");
  return {
    status: isLeadStatus(status) ? status : "",
    type: isLeadType(type) ? type : "",
    q: firstParam(params, "q")?.trim().slice(0, MAX_QUERY_LENGTH) ?? "",
    from: parseIsoDate(firstParam(params, "from")) ?? "",
    to: parseIsoDate(firstParam(params, "to")) ?? "",
  };
}
