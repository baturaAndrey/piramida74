/**
 * Чистые хелперы UI калькулятора (без React и DOM) — покрыты тестами.
 * Логика расчёта и разбор URL — в `src/lib/calculator/*`, здесь только представление.
 */
import type { CalcHall, CalcMenuVariant } from "@/lib/calculator/types";
import type { CalculatorUrlState, KeyQty } from "@/lib/calculator/url-state";

/** Верхняя граница количества в списках `x`/`s`/`i` (совпадает с парсером URL) */
export const MAX_LIST_QTY = 99;
export const MIN_GUESTS = 1;
export const MAX_GUESTS = 100;
export const MIN_HOURS = 0.5;
export const MAX_HOURS = 12;
export const HOURS_STEP = 0.5;

/** Частичное обновление состояния URL; `null` удаляет параметр (возврат к значению по умолчанию) */
export type CalculatorPatch = {
  [K in keyof CalculatorUrlState]?: CalculatorUrlState[K] | null;
};

export interface MenuPickerVariant {
  code: string;
  label: string;
  price: number;
}

export interface MenuPickerItem {
  name: string;
  variants: MenuPickerVariant[];
}

export interface MenuPickerGroup {
  categorySlug: string;
  categoryName: string;
  items: MenuPickerItem[];
}

/**
 * Группирует плоский список вариантов меню: категория → позиция → варианты.
 * Порядок сохраняется таким, как пришёл (`buildMenuVariants` уже отсортировал).
 */
export function groupMenuVariants(variants: CalcMenuVariant[]): MenuPickerGroup[] {
  const groups: MenuPickerGroup[] = [];
  const groupBySlug = new Map<string, MenuPickerGroup>();
  // Позиции различаются по имени внутри своей категории
  const itemByKey = new Map<string, MenuPickerItem>();

  for (const v of variants) {
    let group = groupBySlug.get(v.categorySlug);
    if (!group) {
      group = { categorySlug: v.categorySlug, categoryName: v.categoryName, items: [] };
      groupBySlug.set(v.categorySlug, group);
      groups.push(group);
    }
    const itemKey = `${v.categorySlug}\u0000${v.itemName}`;
    let item = itemByKey.get(itemKey);
    if (!item) {
      item = { name: v.itemName, variants: [] };
      itemByKey.set(itemKey, item);
      group.items.push(item);
    }
    item.variants.push({ code: v.code, label: v.label, price: v.price });
  }
  return groups;
}

/** Фильтр групп по подстроке названия позиции (регистронезависимо); пустые группы отбрасываются */
export function filterMenuGroups(groups: MenuPickerGroup[], query: string): MenuPickerGroup[] {
  const q = query.trim().toLocaleLowerCase("ru-RU");
  if (!q) return groups;
  const out: MenuPickerGroup[] = [];
  for (const g of groups) {
    const items = g.items.filter((it) => it.name.toLocaleLowerCase("ru-RU").includes(q));
    if (items.length) out.push({ ...g, items });
  }
  return out;
}

/**
 * Записать количество по ключу: 0 и меньше — удалить, иначе зажать в 1..99.
 * Новый ключ добавляется в конец, существующий сохраняет позицию.
 */
export function setKeyQty(list: KeyQty[], key: string, qty: number): KeyQty[] {
  const clamped = Math.min(MAX_LIST_QTY, Math.floor(qty));
  if (!(clamped >= 1)) return list.filter((e) => e.key !== key);
  const idx = list.findIndex((e) => e.key === key);
  if (idx === -1) return [...list, { key, qty: clamped }];
  return list.map((e, i) => (i === idx ? { key, qty: clamped } : e));
}

/** Список `KeyQty` → словарь `key → qty` для быстрого поиска в UI */
export function toQtyMap(list: KeyQty[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of list) map[e.key] = e.qty;
  return map;
}

/** Столов по умолчанию в общем зале: `min(tablesCount, ceil(guests / seatsPerTable))`, VIP — 1 */
export function autoTables(hall: CalcHall, guests: number): number {
  if (hall.kind === "vip") return 1;
  const seats = hall.seatsPerTable > 0 ? hall.seatsPerTable : 1;
  return Math.max(1, Math.min(hall.tablesCount, Math.ceil(guests / seats)));
}

const rubFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** 12500 → «12 500 ₽» */
export function formatRub(value: number): string {
  return `${rubFmt.format(value)} ₽`;
}

/** Количество с десятичной запятой: 2.5 → «2,5» */
export function formatQty(value: number): string {
  return numFmt.format(value);
}

/** Длительность в часах: 2 → «2 ч», 2.5 → «2,5 ч» */
export function formatHours(hours: number): string {
  return `${formatQty(hours)} ч`;
}

/** Русское склонение: plural(5, ["гость", "гостя", "гостей"]) → «гостей» */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export const GUEST_FORMS = ["гость", "гостя", "гостей"] as const;

// ---------------------------------------------------------------------------
// Даты YYYY-MM-DD. Считаем в UTC, чтобы пояс браузера не сдвигал день.
// ---------------------------------------------------------------------------

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isoParts(iso: string): [number, number, number] {
  const m = ISO_RE.exec(iso);
  if (!m) throw new RangeError(`Invalid date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function utcDate(iso: string): Date {
  const [y, m, d] = isoParts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

/** «2026-12-31» + 1 → «2027-01-01» */
export function addDays(iso: string, days: number): string {
  const dt = utcDate(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

/** «2026-12-06» → «6 дек» */
export function formatShortDate(iso: string): string {
  const dt = utcDate(iso);
  return `${dt.getUTCDate()} ${MONTHS_SHORT[dt.getUTCMonth()] ?? ""}`;
}

/** «2026-12-05» → «5 декабря 2026, сб» */
export function formatLongDate(iso: string): string {
  const dt = utcDate(iso);
  return `${dt.getUTCDate()} ${MONTHS_GEN[dt.getUTCMonth()] ?? ""} ${dt.getUTCFullYear()}, ${
    WEEKDAYS_SHORT[dt.getUTCDay()] ?? ""
  }`;
}

/**
 * ISO-дата → локальный `Date` (полдень) для календаря: DayPicker работает в поясе браузера,
 * полдень исключает сдвиг дня при переходах на летнее время.
 */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = isoParts(iso);
  return new Date(y, m - 1, d, 12);
}

/** Локальный `Date` из календаря → «YYYY-MM-DD» по его календарным полям */
export function localDateToIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
